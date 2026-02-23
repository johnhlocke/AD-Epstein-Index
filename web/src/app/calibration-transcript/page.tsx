import { CalibrationTranscript } from "./CalibrationTranscript";

export const metadata = {
  title: "Calibration Transcript — Where They Live",
  description:
    "Full transcript of the adversarial calibration session between a licensed architect and Claude Opus, February 15 2026.",
};

export default function CalibrationTranscriptPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#1B1815" }}>
      <CalibrationTranscript />
    </main>
  );
}
