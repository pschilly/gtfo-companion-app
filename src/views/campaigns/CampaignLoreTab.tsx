import React, { useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  BookOpen,
  CaretLeft,
  CaretRight,
  Radio,
  VideoCamera,
} from '@phosphor-icons/react';
import { CampaignItem, CampaignLoreChapter } from '../../types';

interface CampaignLoreTabProps {
  campaign: CampaignItem;
  onOpenExternal: (url?: string | null, fallbackPath?: string) => void;
}

export const CampaignLoreTab: React.FC<CampaignLoreTabProps> = ({
  campaign,
  onOpenExternal,
}) => {
  const chapters = campaign.lores || [];
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(
    chapters[0]?.id ?? null
  );
  const [currentPageIdx, setCurrentPageIdx] = useState(0);

  useEffect(() => {
    setSelectedChapterId(chapters[0]?.id ?? null);
    setCurrentPageIdx(0);
  }, [campaign.id]);

  useEffect(() => {
    if (selectedChapterId && !chapters.some((c) => c.id === selectedChapterId)) {
      setSelectedChapterId(chapters[0]?.id ?? null);
      setCurrentPageIdx(0);
    }
  }, [chapters, selectedChapterId]);

  if (chapters.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 p-12 text-center space-y-3">
        <BookOpen weight="duotone" className="w-12 h-12 text-stone-600 mx-auto" />
        <div className="space-y-1">
          <h3 className="font-display font-bold text-base text-stone-200">
            No Published Chronicles Yet
          </h3>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            No lore chapters have been published for {campaign.name}. Check back as operations unfold.
          </p>
        </div>
      </div>
    );
  }

  const activeChapterIdx = Math.max(
    0,
    chapters.findIndex((c) => c.id === selectedChapterId)
  );
  const currentChapter: CampaignLoreChapter = chapters[activeChapterIdx] || chapters[0];
  const pages = currentChapter.pages || [];
  const safePageIdx = Math.min(Math.max(0, currentPageIdx), Math.max(0, pages.length - 1));
  const currentPage = pages[safePageIdx] || null;

  const handleSelectChapter = (chapter: CampaignLoreChapter) => {
    setSelectedChapterId(chapter.id);
    setCurrentPageIdx(0);
  };

  const canGoPrev = safePageIdx > 0 || activeChapterIdx > 0;
  const canGoNext = safePageIdx < pages.length - 1 || activeChapterIdx < chapters.length - 1;

  const handlePrev = () => {
    if (safePageIdx > 0) {
      setCurrentPageIdx(safePageIdx - 1);
      return;
    }
    if (activeChapterIdx > 0) {
      const prevChap = chapters[activeChapterIdx - 1];
      setSelectedChapterId(prevChap.id);
      setCurrentPageIdx(Math.max(0, (prevChap.pages?.length || 1) - 1));
    }
  };

  const handleNext = () => {
    if (safePageIdx < pages.length - 1) {
      setCurrentPageIdx(safePageIdx + 1);
      return;
    }
    if (activeChapterIdx < chapters.length - 1) {
      const nextChap = chapters[activeChapterIdx + 1];
      setSelectedChapterId(nextChap.id);
      setCurrentPageIdx(0);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT 4 COLS: Chapter Table of Contents */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen weight="duotone" className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                Chronicles &amp; Lore
              </h3>
            </div>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {chapters.map((chapter, idx) => {
              const isSelected = chapter.id === currentChapter.id;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => handleSelectChapter(chapter)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-1 ${
                    isSelected
                      ? 'bg-stone-950 border-amber-500/50 ring-1 ring-amber-500/20 shadow-md'
                      : 'bg-stone-950/50 border-stone-800 hover:border-stone-700 hover:bg-stone-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="text-amber-400 uppercase tracking-wider">
                      Chapter {chapter.order || idx + 1}
                    </span>
                    <span className="text-stone-500 tabular-nums font-normal">
                      {chapter.pages.length || 1} page{chapter.pages.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div
                    className={`font-display font-bold text-sm leading-snug ${
                      isSelected ? 'text-amber-200' : 'text-stone-100'
                    }`}
                  >
                    {chapter.title}
                  </div>
                  {chapter.author && (
                    <div className="text-xs text-stone-400 truncate">
                      By {chapter.author}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT 8 COLS: Chapter Page Reader */}
      <div className="lg:col-span-8">
        <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 sm:p-7 shadow-xl space-y-5">
          {/* Chapter Header */}
          <div className="border-b border-stone-800/80 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold uppercase tracking-wider tabular-nums">
                Chapter {currentChapter.order || activeChapterIdx + 1} &bull; Page{' '}
                {safePageIdx + 1} of {Math.max(1, pages.length)}
              </span>
              {currentChapter.author && (
                <span className="text-xs text-stone-400">
                  Byline: <strong className="text-stone-200">{currentChapter.author}</strong>
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl font-black text-stone-100">
              {currentChapter.title}
            </h2>

            {currentChapter.summary && (
              <blockquote className="p-3.5 rounded-2xl bg-stone-950/70 border-l-2 border-amber-500/60 text-xs italic text-stone-300 leading-relaxed">
                {currentChapter.summary}
              </blockquote>
            )}

            {currentChapter.coverImageUrl && safePageIdx === 0 && (
              <div className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 max-h-64">
                <img
                  src={currentChapter.coverImageUrl}
                  alt={currentChapter.title}
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}
          </div>

          {/* Active Page Content */}
          {currentPage ? (
            <div className="space-y-4">
              {currentPage.title && (
                <h3 className="font-display text-lg font-bold text-amber-300">
                  {currentPage.title}
                </h3>
              )}

              {currentPage.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-950">
                  <img
                    src={currentPage.imageUrl}
                    alt={currentPage.title || currentChapter.title}
                    className="w-full max-h-80 object-contain mx-auto"
                  />
                </div>
              )}

              {currentPage.audioUrl && (
                <div className="p-3.5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                    <Radio weight="duotone" className="w-4 h-4" />
                    <span>{currentPage.audioTitle || 'Comms Intercept Audio'}</span>
                  </div>
                  <audio controls className="w-full">
                    <source src={currentPage.audioUrl} />
                  </audio>
                </div>
              )}

              {(currentPage.videoEmbedUrl || currentPage.videoUrl) && (
                <div className="p-3.5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
                      <VideoCamera weight="duotone" className="w-4 h-4" />
                      <span>{currentPage.videoTitle || 'HUD / Tactical Video Footage'}</span>
                    </div>
                    {currentPage.videoUrl && (
                      <button
                        type="button"
                        onClick={() => onOpenExternal(currentPage.videoUrl)}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
                      >
                        <span>Open Video</span>
                        <ArrowSquareOut className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {currentPage.videoEmbedUrl ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-stone-800 bg-black">
                      <iframe
                        title={currentPage.videoTitle || 'Lore Video'}
                        src={currentPage.videoEmbedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    currentPage.videoUrl && (
                      <video controls preload="metadata" className="w-full max-h-80 rounded-xl bg-black">
                        <source src={currentPage.videoUrl} />
                      </video>
                    )
                  )}
                </div>
              )}

              {currentPage.contentHtml ? (
                <div
                  className="prose prose-invert prose-stone max-w-none text-sm text-stone-200 leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-amber-300 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic"
                  dangerouslySetInnerHTML={{ __html: currentPage.contentHtml }}
                />
              ) : (
                <p className="text-xs text-stone-500 italic">This page has no written text.</p>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-500">
              No pages available in this chapter.
            </div>
          )}

          {/* Page Navigation Controls */}
          <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs font-semibold text-stone-200 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <CaretLeft className="w-3.5 h-3.5" />
              <span>Previous Page</span>
            </button>

            {pages.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {pages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCurrentPageIdx(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                      idx === safePageIdx
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next Page</span>
              <CaretRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
