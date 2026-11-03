import React, { useMemo, useState } from 'react';
import {
  AirplaneTilt,
  ArrowSquareOut,
  BookmarkSimple,
  CaretDown,
  CaretUp,
  Certificate,
  CheckCircle,
  Clock,
  Compass,
  Funnel,
  GraduationCap,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Sparkle,
  Star,
  Target,
  Trash,
  X,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { QualificationCourse } from '../types';

const HtmlRenderer: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => {
  if (!html) return null;
  return (
    <div
      className={`prose prose-invert prose-xs max-w-none text-stone-300 leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5 [&_strong]:text-amber-300 [&_em]:text-stone-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const QualificationsZoneView: React.FC = () => {
  const {
    qualificationsCatalog,
    isLoadingTaskforce,
    refreshTaskforceData,
    memberProfile,
    settings,
    toggleTrackedQualification,
    toggleQualificationCheckpoint,
    isQualificationTracked,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'tracked' | 'issued'>('all');
  const [selectedAirframe, setSelectedAirframe] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<number, boolean>>({});

  const trackedIds = settings.trackedQualificationIds || [];
  const completedCheckpoints = settings.completedQualificationCheckpoints || {};

  // Issued cert codes/slugs for cross-checking
  const issuedCertCodes = useMemo(() => {
    const set = new Set<string>();
    (memberProfile.certificates || []).forEach((c) => {
      if (c.code) set.add(c.code.toUpperCase());
      if (c.slug) set.add(c.slug.toLowerCase());
      if (c.id) set.add(String(c.id));
    });
    return set;
  }, [memberProfile.certificates]);

  const isCourseIssued = (course: QualificationCourse): boolean => {
    if (issuedCertCodes.has(String(course.id))) return true;
    if (course.code && issuedCertCodes.has(course.code.toUpperCase())) return true;
    if (course.slug && issuedCertCodes.has(course.slug.toLowerCase())) return true;
    return false;
  };

  // Derive unique airframes for filtering
  const availableAirframes = useMemo(() => {
    const set = new Set<string>();
    qualificationsCatalog.forEach((c) => {
      if (c.airframe) set.add(c.airframe);
      if (c.airframes) c.airframes.forEach((af) => set.add(af));
    });
    return Array.from(set).sort();
  }, [qualificationsCatalog]);

  // Derive unique categories for filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    qualificationsCatalog.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [qualificationsCatalog]);

  // Filter courses based on activeTab, airframe, category, and search
  const filteredCourses = useMemo(() => {
    return qualificationsCatalog.filter((course) => {
      const isIssued = isCourseIssued(course);
      const isTracked = isQualificationTracked(course.id);

      if (activeTab === 'tracked' && !isTracked) return false;
      if (activeTab === 'issued' && !isIssued) return false;

      if (selectedAirframe !== 'all') {
        const matchesAirframe =
          course.airframe === selectedAirframe ||
          (course.airframes && course.airframes.includes(selectedAirframe));
        if (!matchesAirframe) return false;
      }

      if (selectedCategory !== 'all' && course.category !== selectedCategory) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        course.code.toLowerCase().includes(q) ||
        course.name.toLowerCase().includes(q) ||
        (course.airframe && course.airframe.toLowerCase().includes(q)) ||
        course.category.toLowerCase().includes(q) ||
        (course.description && course.description.toLowerCase().includes(q)) ||
        course.requirements.some(
          (r) =>
            r.skill.toLowerCase().includes(q) ||
            r.benchmarks.toLowerCase().includes(q)
        )
      );
    });
  }, [
    qualificationsCatalog,
    activeTab,
    selectedAirframe,
    selectedCategory,
    searchQuery,
    issuedCertCodes,
    trackedIds,
  ]);

  const toggleCourseExpand = (id: number) => {
    setExpandedCourseIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    filteredCourses.forEach((c) => {
      all[c.id] = true;
    });
    setExpandedCourseIds(all);
  };

  const collapseAll = () => {
    setExpandedCourseIds({});
  };

  const isAllExpanded =
    filteredCourses.length > 0 &&
    filteredCourses.every((c) => expandedCourseIds[c.id]);

  // Calculate LMS readiness stats
  const totalCoursesCount = qualificationsCatalog.length;
  const trackedCoursesCount = qualificationsCatalog.filter((c) => isQualificationTracked(c.id)).length;
  const earnedCredentialsCount = (memberProfile.certificates || []).length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold tracking-wider">
              S3 // TRAINING &amp; DOCTRINE
            </span>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Qualifications Zone &amp; LMS
            </h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Learning Management System for Task Force check flights, tactical syllabus tracks, and certification requirements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <a
            href={STATIC_CONFIG.kbUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Knowledge Base Syllabus</span>
            <ArrowSquareOut className="w-3.5 h-3.5 text-stone-400" />
          </a>

          <button
            onClick={() => refreshTaskforceData()}
            disabled={isLoadingTaskforce}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-2 transition-colors shrink-0 shadow-sm disabled:opacity-50"
          >
            <Compass className={`w-3.5 h-3.5 text-amber-400 ${isLoadingTaskforce ? 'animate-spin' : ''}`} />
            <span>{isLoadingTaskforce ? 'Refreshing...' : 'Refresh LMS'}</span>
          </button>
        </div>
      </div>

      {/* LMS KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Available Qualifications</p>
            <p className="text-2xl font-bold font-display text-amber-400 mt-0.5">
              {totalCoursesCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Official Task Force Syllabi
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Tracked in Progress</p>
            <p className="text-2xl font-bold font-display text-sky-400 mt-0.5">
              {trackedCoursesCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Active in your training queue
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
            <BookmarkSimple className="w-5 h-5 text-sky-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Issued Credentials</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-0.5">
              {earnedCredentialsCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Completed checkrides on record
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* LMS Mode Navigation Tabs & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900/80 border border-stone-800">
        {/* Main Tab Switcher */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-mono self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>All ({totalCoursesCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('tracked')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'tracked'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BookmarkSimple className="w-3.5 h-3.5" />
            <span>Tracked ({trackedCoursesCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('issued')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'issued'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Certificate className="w-3.5 h-3.5" />
            <span>Earned ({earnedCredentialsCount})</span>
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {availableAirframes.length > 0 && (
            <select
              value={selectedAirframe}
              onChange={(e) => setSelectedAirframe(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full sm:w-auto"
            >
              <option value="all">All Airframes</option>
              {availableAirframes.map((af) => (
                <option key={af} value={af}>
                  {af}
                </option>
              ))}
            </select>
          )}

          {availableCategories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full sm:w-auto"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-56">
            <MagnifyingGlass className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search syllabus or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={isAllExpanded ? collapseAll : expandAll}
            className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            {isAllExpanded ? (
              <>
                <CaretUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <CaretDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Expand All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Qualifications Course Catalog */}
      {filteredCourses.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-3">
          <Certificate className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="font-display font-semibold text-stone-300">
            {activeTab === 'tracked'
              ? 'No Tracked Qualifications Yet'
              : 'No Qualifications Match Filter'}
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {activeTab === 'tracked'
              ? 'Click "+ Add to Tracked List" on any qualification from the course catalog to start tracking your syllabus checkpoints and checkride prep.'
              : 'Try clearing your search query or adjusting your filters.'}
          </p>
          {activeTab === 'tracked' && (
            <button
              onClick={() => setActiveTab('all')}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs shadow"
            >
              Browse Course Catalog
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => {
            const isIssued = isCourseIssued(course);
            const isTracked = isQualificationTracked(course.id);
            const isExpanded = Boolean(expandedCourseIds[course.id]);

            // Calculate syllabus progress for this course
            const totalRequirements = course.requirements.length;
            const completedCount = course.requirements.reduce((acc, _, idx) => {
              const key = `${course.id}_${idx}`;
              return completedCheckpoints[key] ? acc + 1 : acc;
            }, 0);
            const progressPercent = totalRequirements > 0
              ? Math.round((completedCount / totalRequirements) * 100)
              : 0;

            return (
              <div
                key={course.id}
                className={`rounded-2xl bg-stone-900/90 border transition-all overflow-hidden shadow-lg ${
                  isIssued
                    ? 'border-emerald-500/40 bg-gradient-to-br from-stone-900 via-stone-900 to-emerald-950/20'
                    : isTracked
                    ? 'border-amber-500/50 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/20 ring-1 ring-amber-500/30'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                {/* Course Header Banner */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Icon & Title info */}
                  <div
                    onClick={() => toggleCourseExpand(course.id)}
                    className="flex items-start gap-4 cursor-pointer select-none flex-1 min-w-0"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner transition-transform group-hover:scale-105 ${
                        isIssued
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : isTracked
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          : 'bg-stone-950 border-stone-800 text-stone-400'
                      }`}
                    >
                      {isIssued ? (
                        <CheckCircle className="w-7 h-7" weight="fill" />
                      ) : isTracked ? (
                        <BookmarkSimple className="w-7 h-7" weight="fill" />
                      ) : (
                        <Certificate className="w-7 h-7" />
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-xs font-bold text-amber-300">
                          {course.code}
                        </span>
                        <h2 className="font-display font-bold text-stone-100 text-lg hover:text-amber-200 transition-colors">
                          {course.name}
                        </h2>

                        {isIssued && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>ISSUED // CHECKRIDE PASSED</span>
                          </span>
                        )}

                        {isTracked && !isIssued && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                            <BookmarkSimple className="w-3 h-3 text-amber-400" />
                            <span>ACTIVE IN TRAINING QUEUE</span>
                          </span>
                        )}
                      </div>

                      {/* Course Metadata Strip */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-stone-400">
                        {course.airframe && (
                          <span className="inline-flex items-center gap-1.5 text-stone-300">
                            <AirplaneTilt className="w-3.5 h-3.5 text-amber-400" />
                            <span>{course.airframe}</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-400 text-[10px]">
                          {course.category}
                        </span>
                        {course.awardedRole && (
                          <span className="text-stone-400 capitalize">
                            Role: <strong className="text-stone-300">{course.awardedRole}</strong>
                          </span>
                        )}
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Sparkle className="w-3.5 h-3.5" />
                          <span>+{course.xpValue.toLocaleString()} XP</span>
                        </span>
                        <span className="text-stone-500">
                          {course.requirements.length} Syllabus Modules
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: LMS Action & Tracking Controls */}
                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      onClick={() => toggleTrackedQualification(course.id)}
                      className={`px-3.5 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                        isTracked
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300'
                          : 'bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300'
                      }`}
                    >
                      {isTracked ? (
                        <>
                          <BookmarkSimple className="w-3.5 h-3.5 text-amber-400" weight="fill" />
                          <span>Tracked (In Queue)</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Add to Tracked List</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => toggleCourseExpand(course.id)}
                      className="px-3 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-stone-100 font-mono text-xs flex items-center gap-1 transition-colors"
                      title={isExpanded ? 'Collapse Syllabus' : 'Expand Syllabus'}
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Syllabus'}</span>
                      {isExpanded ? (
                        <CaretUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <CaretDown className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Tracked Progress Bar (if in queue) */}
                {isTracked && (
                  <div className="px-5 py-2 bg-stone-950/70 border-t border-stone-800/80 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-stone-400">Self-Paced Progress:</span>
                      <span className="text-amber-300 font-bold">
                        {completedCount} of {totalRequirements} Hops Completed ({progressPercent}%)
                      </span>
                    </div>

                    <div className="w-48 h-2 rounded-full bg-stone-800 overflow-hidden shrink-0">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Expanded Syllabus & How to Obtain Breakdown */}
                {isExpanded && (
                  <div className="p-6 pt-4 border-t border-stone-800/80 bg-stone-950/40 space-y-6 animate-fadeIn">
                    {/* How to Obtain Instructions */}
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400 shrink-0" />
                        <h4 className="font-display font-bold text-amber-300 text-xs tracking-wider uppercase">
                          How to Obtain this Qualification
                        </h4>
                      </div>
                      <ol className="list-decimal pl-5 text-xs text-stone-300 space-y-1 leading-relaxed">
                        <li>
                          <strong>Airframe Readiness:</strong> Familiarize yourself with the{' '}
                          <span className="text-amber-300">{course.airframe || 'designated platform'}</span>{' '}
                          avionics, startup checklist, and flight profiles.
                        </li>
                        <li>
                          <strong>Syllabus Practice:</strong> Review and practice all required syllabus hops and skills outlined below in single-player or on the GTFO training server.
                        </li>
                        <li>
                          <strong>Schedule Check Flight:</strong> When confident, coordinate with a designated Squadron Instructor or Flight Leader in Discord to schedule your evaluation check flight.
                        </li>
                        <li>
                          <strong>Official Signoff:</strong> Upon meeting all checkride benchmarks, the instructor logs your pass and awards your certificate +{course.xpValue.toLocaleString()} XP.
                        </li>
                      </ol>
                    </div>

                    {/* Syllabus Hops Accordion / Grid */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider flex items-center gap-2">
                        <span>Required Training Syllabi &amp; Flight Hops</span>
                        <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[10px] text-amber-400">
                          {course.requirements.length} Hops
                        </span>
                      </h4>

                      {course.requirements.length === 0 ? (
                        <p className="text-xs text-stone-500 italic p-3 rounded-xl bg-stone-950 border border-stone-800">
                          No structured hops recorded for this syllabus yet. Check the Knowledge Base for guidelines.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {course.requirements.map((req, reqIdx) => {
                            const checkpointKey = `${course.id}_${reqIdx}`;
                            const isChecked = Boolean(completedCheckpoints[checkpointKey]);

                            return (
                              <div
                                key={reqIdx}
                                className={`p-4 rounded-xl border transition-all ${
                                  isChecked
                                    ? 'bg-emerald-950/20 border-emerald-500/40'
                                    : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <button
                                      onClick={() => toggleQualificationCheckpoint(checkpointKey)}
                                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                        isChecked
                                          ? 'bg-emerald-500 border-emerald-400 text-stone-950'
                                          : 'bg-stone-900 border-stone-700 text-transparent hover:border-amber-400'
                                      }`}
                                      title={isChecked ? 'Mark Incomplete' : 'Mark Completed'}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                                    </button>

                                    <div>
                                      <h5
                                        className={`font-display font-bold text-sm ${
                                          isChecked ? 'text-emerald-300 line-through' : 'text-stone-200'
                                        }`}
                                      >
                                        {req.skill || `Module ${reqIdx + 1}`}
                                      </h5>
                                      <div className="mt-2 text-xs">
                                        <HtmlRenderer html={req.benchmarks} />
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 border ${
                                      isChecked
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                        : 'bg-stone-900 border-stone-800 text-stone-400'
                                    }`}
                                  >
                                    {isChecked ? 'COMPLETED' : 'PENDING'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
