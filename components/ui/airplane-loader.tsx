'use client';

interface AirplaneLoaderProps {
  label?: string;
  className?: string;
}

export function AirplaneLoader({ label = 'Processing…', className }: AirplaneLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className ?? ''}`}>
      <div className="relative h-40 w-full max-w-xs overflow-hidden">
        {/* Long fazers (speed lines) */}
        <div className="longfazers absolute inset-0">
          <span className="lf-1" />
          <span className="lf-2" />
          <span className="lf-3" />
          <span className="lf-4" />
        </div>

        {/* Airplane body */}
        <div className="airplane absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Tail / wings on top */}
          <div className="airplane-tail" />
          {/* Fuselage */}
          <div className="airplane-base">
            <div className="airplane-wing" />
            <div className="airplane-wheel" />
            <div className="airplane-face">
              <div className="airplane-face-tip" />
            </div>
          </div>
        </div>
      </div>

      {label && (
        <p className="font-mono text-[12px] tracking-widest text-purple-600 uppercase animate-pulse">
          {label}
        </p>
      )}

      <style jsx>{`
        .airplane {
          animation: speeder 0.4s linear infinite;
        }
        .airplane-tail {
          height: 5px;
          width: 35px;
          background: #5B2C6F;
          position: absolute;
          top: -19px;
          left: 60px;
          border-radius: 2px 10px 1px 0;
        }
        .airplane-base {
          position: relative;
        }
        .airplane-wing {
          position: absolute;
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-right: 100px solid #5B2C6F;
          border-bottom: 6px solid transparent;
        }
        .airplane-wheel {
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #5B2C6F;
          right: -110px;
          top: -16px;
        }
        .airplane-wheel::after {
          content: '';
          position: absolute;
          width: 0;
          height: 0;
          border-top: 0 solid transparent;
          border-right: 55px solid #5B2C6F;
          border-bottom: 16px solid transparent;
          top: -16px;
          right: -98px;
        }
        .airplane-face {
          position: absolute;
          height: 12px;
          width: 20px;
          background: #5B2C6F;
          border-radius: 20px 20px 0 0;
          transform: rotate(-40deg);
          right: -125px;
          top: -15px;
        }
        .airplane-face-tip {
          height: 12px;
          width: 12px;
          background: #5B2C6F;
          right: 4px;
          top: 7px;
          position: absolute;
          transform: rotate(40deg);
          transform-origin: 50% 50%;
          border-radius: 0 0 0 2px;
        }

        .lf-1, .lf-2, .lf-3, .lf-4 {
          position: absolute;
          height: 2px;
          width: 20%;
          background: #5B2C6F;
        }
        .lf-1 { top: 20%; animation: lf 0.6s linear infinite; animation-delay: -5s; }
        .lf-2 { top: 40%; animation: lf2 0.8s linear infinite; animation-delay: -1s; }
        .lf-3 { top: 60%; animation: lf3 0.6s linear infinite; }
        .lf-4 { top: 80%; animation: lf4 0.5s linear infinite; animation-delay: -3s; }

        @keyframes speeder {
          0%   { transform: translate(2px, 1px) rotate(0deg); }
          10%  { transform: translate(-1px, -3px) rotate(-1deg); }
          20%  { transform: translate(-2px, 0px) rotate(1deg); }
          30%  { transform: translate(1px, 2px) rotate(0deg); }
          40%  { transform: translate(1px, -1px) rotate(1deg); }
          50%  { transform: translate(-1px, 3px) rotate(-1deg); }
          60%  { transform: translate(-1px, 1px) rotate(0deg); }
          70%  { transform: translate(3px, 1px) rotate(-1deg); }
          80%  { transform: translate(-2px, -1px) rotate(1deg); }
          90%  { transform: translate(2px, 1px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        @keyframes lf {
          0%   { left: 200%; }
          100% { left: -200%; opacity: 0; }
        }
        @keyframes lf2 {
          0%   { left: 200%; }
          100% { left: -200%; opacity: 0; }
        }
        @keyframes lf3 {
          0%   { left: 200%; }
          100% { left: -100%; opacity: 0; }
        }
        @keyframes lf4 {
          0%   { left: 200%; }
          100% { left: -100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
