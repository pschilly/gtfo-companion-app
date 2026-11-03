import { invoke } from '@tauri-apps/api/core';
import { normalizeCompanionBaseUrl } from './flightPlanService';
import { isTauriRuntime, sendPortalApiRequest } from './tauriBridge';

export interface HeroImageItem {
  id: number;
  title: string;
  credit: string;
  caption?: string | null;
  theatre?: string | null;
  image_url: string;
  created_at?: string;
}

export interface HeroImagesResponse {
  success: boolean;
  images: HeroImageItem[];
}

export async function fetchHeroImages(
  baseUrl: string,
  token?: string
): Promise<HeroImageItem[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/hero-images`;

  if (isTauriRuntime()) {
    try {
      const res = await invoke<HeroImagesResponse>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (res && Array.isArray(res.images)) {
        return res.images;
      }
    } catch (err) {
      console.warn('Native fetch hero images failed, trying fallback:', err);
    }
  }

  try {
    const res = await sendPortalApiRequest<HeroImagesResponse>(
      endpoint,
      'GET',
      undefined,
      token
    );
    return res && Array.isArray(res.images) ? res.images : [];
  } catch (err) {
    console.warn('Fallback fetch hero images failed:', err);
    return [];
  }
}
