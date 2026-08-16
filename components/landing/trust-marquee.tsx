'use client';

const UNIVERSITIES = [
  'Federal University of Technology',
  'University of Lagos',
  'Ahmadu Bello University',
  'Covenant University',
  'Obafemi Awolowo University',
  'University of Ibadan',
  'Federal University Oye-Ekiti',
  'Bells University of Technology',
];

export default function TrustMarquee() {
  const row = [...UNIVERSITIES, ...UNIVERSITIES];
  return (
    <section className="border-y border-white/5 bg-[#04070e] py-7">
      <div className="mx-auto mb-5 flex items-center justify-center gap-3 text-center">
        <span className="h-px w-8 bg-white/10" />
        <p className="font-mono text-[10px] tracking-[0.35em] text-slate-500 uppercase">
          Powering examination offices at
        </p>
        <span className="h-px w-8 bg-white/10" />
      </div>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee gap-12 hover:[animation-play-state:paused]">
          {row.map((u, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-mono text-[13px] font-medium tracking-wide text-slate-500 transition-colors hover:text-slate-300"
            >
              {u}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
