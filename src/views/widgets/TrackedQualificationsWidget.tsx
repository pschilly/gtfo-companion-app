import React, { useMemo } from 'react';
import { ArrowRight, Certificate, GraduationCap } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const TrackedQualificationsWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const { memberProfile, qualificationsCatalog, settings, setActiveTab } = useApp();
  const { maxListCount, listContainerClass } = getWidgetListLayout(colSpan);

  const trackedCourses = useMemo(() => {
    const ids = new Set(settings.trackedQualificationIds || []);
    return qualificationsCatalog.filter((c) => ids.has(c.id));
  }, [qualificationsCatalog, settings.trackedQualificationIds]);

  const issuedCertCount = useMemo(() => {
    return (memberProfile.certificates || []).filter((c) => c.isIssued).length;
  }, [memberProfile.certificates]);

  const trackedSlice = trackedCourses.slice(0, maxListCount);
  const completedCheckpoints = settings.completedQualificationCheckpoints || {};

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                Training Queue &amp; Certifications
              </h3>
              <p className="text-[11px] font-mono text-stone-400">
                Tracked LMS courses &amp; earned quals
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('qualifications_zone')}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <span>Quals Zone</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {trackedSlice.length > 0 ? (
          <div className={listContainerClass}>
            {trackedSlice.map((course) => {
              const totalReq = course.requirements?.length || 0;
              const doneReq = (course.requirements || []).reduce((acc, _, idx) => {
                return completedCheckpoints[`${course.id}_${idx}`] ? acc + 1 : acc;
              }, 0);
              const pct = totalReq > 0 ? Math.round((doneReq / totalReq) * 100) : 0;

              return (
                <div
                  key={course.id}
                  onClick={() => setActiveTab('qualifications_zone')}
                  className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-emerald-500/40 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        {course.code}
                      </span>
                      <span className="font-bold text-xs text-stone-100 group-hover:text-emerald-300 transition truncate">
                        {course.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 shrink-0">
                      {doneReq}/{totalReq} checks
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold shrink-0">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 py-7 px-4 text-center space-y-2">
            <Certificate className="w-7 h-7 text-stone-600 mx-auto" />
            <p className="text-xs font-mono text-stone-400">
              No courses currently tracked in your training queue.
            </p>
            <button
              onClick={() => setActiveTab('qualifications_zone')}
              className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <span>Browse Qualifications Zone</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
        <span>{issuedCertCount} issued certification(s)</span>
        <button
          onClick={() => setActiveTab('qualifications')}
          className="text-emerald-400 hover:text-emerald-300 font-bold"
        >
          My Certifications &rarr;
        </button>
      </div>
    </>
  );
};
