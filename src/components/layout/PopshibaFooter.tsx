import logo from "@/assets/popshiba-logo.png";

export function PopshibaFooter() {
  return (
    <footer
      className="mt-8"
      style={{ background: "#0e0b08", color: "#fff4dc", padding: "40px 28px 24px" }}
    >
      <div
        className="max-w-[1440px] mx-auto flex items-center justify-between gap-6 flex-wrap"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#a49a8a",
          letterSpacing: "0.05em",
        }}
      >
        <span
          className="flex items-center gap-2.5"
          style={{ color: "#f5a524", fontFamily: "'Archivo Black', sans-serif", fontSize: 14 }}
        >
          <span className="relative inline-block w-7 h-7">
            <span
              className="absolute inset-0 rounded-[2px] border"
              style={{ background: "#f5e6c8", borderColor: "#f5a524", transform: "rotate(-6deg)", zIndex: 0 }}
            />
            <span
              className="absolute inset-0 rounded-[2px] border"
              style={{ background: "#fff", borderColor: "#f5a524", transform: "rotate(3deg)", zIndex: 1 }}
            />
            <img
              src={logo}
              alt=""
              className="relative w-[86%] h-[86%] m-[7%] object-contain"
              style={{ zIndex: 2, transform: "rotate(3deg)" }}
            />
          </span>
          POPSHIBA
        </span>
        <span>© 2026 POPSHIBA · NOT FINANCIAL ADVICE · DYOR, DEGEN</span>
        <span>BUILT WITH BARK ON ETHEREUM</span>
      </div>
    </footer>
  );
}
