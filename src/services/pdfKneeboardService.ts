import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { invoke } from '@tauri-apps/api/core';
import { STATIC_CONFIG } from '../config/constants';
import { FlightPlanDetail, FlightPlanSummary } from '../types';
import { getFlightPlanPdfUrl, installAircraftKneeboardPageCommand } from './flightPlanService';
import { isTauriRuntime } from './tauriBridge';

// Configure pdf.js worker URL
try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
} catch (e) {
  console.warn('Failed to set pdfjs workerSrc:', e);
}

/**
 * Derives clean Flight Plan prefix following GTFO kneeboard convention:
 * e.g., "FP-TARCAP", "FP-VIPER 1-1", etc.
 */
export function getFlightPlanPrefix(plan: FlightPlanDetail | FlightPlanSummary): string {
  const identifier = (plan.identifier || '').trim();
  if (identifier) {
    const prefixed = identifier.toUpperCase().startsWith('FP-')
      ? identifier
      : `FP-${identifier}`;
    return prefixed.replace(/[/\\?%*:|"<>]/g, '_');
  }

  const fallback = (plan.callsign || plan.name || 'TARCAP').trim();
  const prefixed = fallback.toUpperCase().startsWith('FP-')
    ? fallback
    : `FP-${fallback}`;
  return prefixed.replace(/[/\\?%*:|"<>]/g, '_');
}

/**
 * Converts a base64 string to a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetches PDF bytes as a Uint8Array.
 * Uses native Tauri command if available (bypassing CORS), otherwise browser fetch.
 */
export async function fetchPdfBytes(pdfUrl: string, token?: string): Promise<Uint8Array> {
  if (isTauriRuntime()) {
    try {
      const base64Data = await invoke<string>('fetch_portal_binary', {
        endpointUrl: pdfUrl,
        accessToken: token || null,
      });
      if (base64Data && base64Data.length > 0) {
        return base64ToUint8Array(base64Data);
      }
    } catch (err) {
      console.warn('Native fetch_portal_binary failed, falling back to browser fetch:', err);
    }
  }

  const headers: Record<string, string> = { Accept: 'application/pdf, application/octet-stream, */*' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(pdfUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download PDF: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Renders each page of a PDF document to a PNG base64 string.
 * Scale of 2.0 provides crisp 150-200 DPI resolution for DCS in-cockpit kneeboards.
 */
export async function renderPdfPagesToPngBase64(
  pdfBytes: Uint8Array,
  scale = 2.0,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Could not create 2D canvas context for page ${pageNum}`);
    }

    // Fill white background to prevent transparent DCS kneeboard rendering artifacts
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const base64Only = dataUrl.replace(/^data:image\/png;base64,/, '');
    images.push(base64Only);
  }

  return images;
}

/**
 * Synthesizes a high-contrast kneeboard brief image if offline or PDF is unavailable.
 * Generates standard DCS 3:4 kneeboard proportion (1024x1365).
 */
export function generateSyntheticKneeboardPage(plan: FlightPlanDetail): string {
  const width = 1024;
  const height = 1365;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#1c1917'; // stone-900
  ctx.fillRect(0, 0, width, height);

  // Border & Header Box
  ctx.strokeStyle = '#f59e0b'; // amber-500
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(20, 20, width - 40, 70);

  // Header Text
  ctx.fillStyle = '#0c0a09'; // stone-950
  ctx.font = 'bold 30px monospace';
  ctx.fillText(`GTFO FLIGHT PLAN // ${getFlightPlanPrefix(plan)}`, 40, 66);

  // Metadata Panel
  ctx.fillStyle = '#292524'; // stone-800
  ctx.fillRect(40, 110, width - 80, 220);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`CALLSIGN:   ${plan.callsign || 'N/A'}`, 60, 145);
  ctx.fillText(`AIRFRAME:   ${plan.airframe?.name || 'N/A'} (${plan.airframe?.dcs_entity || 'N/A'})`, 60, 180);
  ctx.fillText(`SQUADRON:   ${plan.squadron?.name || 'N/A'}`, 60, 215);
  ctx.fillText(`DEPARTURE:  ${plan.departure_airfield || 'N/A'}`, 60, 250);
  ctx.fillText(`ARRIVAL:    ${plan.destination_airfield || 'N/A'}`, 60, 285);

  ctx.fillStyle = '#a8a29e';
  ctx.font = '18px monospace';
  ctx.fillText(`MISSION:    ${plan.mission?.name || 'Independent'}`, 540, 145);
  ctx.fillText(`SORTIE:     ${plan.sortie?.name || 'Sortie 1'}`, 540, 180);
  ctx.fillText(`LAUNCH:     ${plan.launch_time || 'ASAP'}`, 540, 215);
  ctx.fillText(`FUEL:       ${plan.fuel_amount || 'FULL'}`, 540, 250);
  ctx.fillText(`RULES:      ${plan.flight_rules || 'VFR'}`, 540, 285);

  // Waypoints Header
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('--- ROUTE WAYPOINTS ---', 40, 370);

  // Waypoints Table
  let y = 410;
  ctx.fillStyle = '#d6d3d1';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('IDX  NAME                 ALT (FT)   SPEED (KTS)  MGRS / COORDS', 40, y);
  y += 10;
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(width - 40, y);
  ctx.stroke();
  y += 25;

  ctx.font = '15px monospace';
  const waypoints = plan.route_points || [];
  for (const wp of waypoints.slice(0, 18)) {
    const idxStr = String(wp.index).padEnd(5);
    const nameStr = (wp.name || 'WPT').slice(0, 20).padEnd(21);
    const altStr = `${wp.alt || 0}`.padStart(6).padEnd(11);
    const spdStr = `${wp.speed || 0}`.padStart(5).padEnd(13);
    const coords = wp.mgrs || `${wp.lat.toFixed(3)}, ${wp.lng.toFixed(3)}`;

    ctx.fillStyle = '#e7e5e4';
    ctx.fillText(`${idxStr}${nameStr}${altStr}${spdStr}${coords}`, 40, y);
    y += 24;
  }

  // Remarks Section
  if (plan.remarks) {
    y = Math.max(y + 30, 960);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('--- DISPATCH REMARKS ---', 40, y);
    y += 30;

    ctx.fillStyle = '#a8a29e';
    ctx.font = '16px monospace';
    ctx.fillText(plan.remarks.slice(0, 90), 40, y);
  }

  // Footer
  ctx.fillStyle = '#78716c';
  ctx.font = '14px monospace';
  ctx.fillText('GENERATED BY GTFO COMPANION APP // KNEEBOARD DISPATCH SYSTEM', 40, height - 40);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

export interface ExportKneeboardResult {
  success: boolean;
  filePaths: string[];
  fileNames: string[];
  folderName: string;
  targetDirectory: string;
  pageCount: number;
  prefix: string;
}

/**
 * Downloads the flight plan PDF, converts every page into a PNG image,
 * and installs them directly into Saved Games\DCS\Kneeboard\<aircraftFolder>\<prefix> - Page <N>.png
 */
export async function exportFlightPlanKneeboardPages(
  plan: FlightPlanDetail,
  baseUrl: string,
  customDcsPath?: string,
  token?: string,
  onProgress?: (status: string) => void
): Promise<ExportKneeboardResult> {
  const prefix = getFlightPlanPrefix(plan);
  const aircraftFolder = plan.airframe?.dcs_entity || 'ALL';
  const pdfUrl = plan.download_urls?.pdf || getFlightPlanPdfUrl(baseUrl, plan.id);

  let pngPagesBase64: string[] = [];

  onProgress?.('Fetching PDF from portal...');
  try {
    const bytes = await fetchPdfBytes(pdfUrl, token);
    onProgress?.('Rendering PDF pages to images...');
    pngPagesBase64 = await renderPdfPagesToPngBase64(bytes, 2.0, (curr, total) => {
      onProgress?.(`Rendering page ${curr} of ${total}...`);
    });
  } catch (err) {
    console.warn('Failed to fetch/render remote PDF, synthesizing high-res kneeboard page:', err);
    onProgress?.('Creating kneeboard dispatch image...');
    const synthPage = generateSyntheticKneeboardPage(plan);
    if (synthPage) {
      pngPagesBase64 = [synthPage];
    } else {
      throw new Error(`Failed to produce kneeboard image: ${String(err)}`);
    }
  }

  if (pngPagesBase64.length === 0) {
    throw new Error('PDF contained zero renderable pages.');
  }

  onProgress?.(`Saving ${pngPagesBase64.length} kneeboard image(s) to DCS folder...`);

  const installedFilePaths: string[] = [];
  const installedFileNames: string[] = [];

  for (let i = 0; i < pngPagesBase64.length; i++) {
    const pageNum = i + 1;
    const fileName = `${prefix} - Page ${pageNum}.png`;
    const imageBase64 = pngPagesBase64[i];

    const savedPath = await installAircraftKneeboardPageCommand(
      aircraftFolder,
      fileName,
      imageBase64,
      true, // binary PNG
      customDcsPath
    );

    installedFilePaths.push(savedPath);
    installedFileNames.push(fileName);
  }

  // Derive target folder path from the first installed file
  const firstPath = installedFilePaths[0] || '';
  const lastSlash = Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/'));
  const targetDirectory = lastSlash !== -1 ? firstPath.substring(0, lastSlash) : `Saved Games\\DCS\\Kneeboard\\${aircraftFolder}`;

  return {
    success: true,
    filePaths: installedFilePaths,
    fileNames: installedFileNames,
    folderName: aircraftFolder,
    targetDirectory,
    pageCount: installedFilePaths.length,
    prefix,
  };
}
