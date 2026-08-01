import "./OperationsPrototypePage.css";

export default function OperationsPrototypePage() {
  return <main className="operations-prototype-page">
    <iframe
      className="operations-prototype-frame"
      src="/operations-ui/index.html"
      title="FTMS Operations Prototype"
    />
  </main>;
}
