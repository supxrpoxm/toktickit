import { useEffect, useState } from "react";
import { fetchActiveRequesters, Requester } from "./api.js";

const zenGreen = "#006B3C";

export default function RequesterSelect() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadRequesters() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchActiveRequesters();
        if (!ignore) {
          setRequesters(data);
        }
      } catch (err) {
        if (!ignore) {
          setError("Unable to load active requesters right now.");
          setRequesters([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadRequesters();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 480 }}>
      <label htmlFor="requester-select" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
        Requester
      </label>

      {loading && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f3f7f4",
            color: zenGreen,
            border: `1px solid ${zenGreen}33`,
          }}
        >
          Loading active requesters…
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff3f3",
            color: "#8a1f1f",
            border: "1px solid #f5c2c7",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <select
          id="requester-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1.5px solid ${zenGreen}`,
            background: "#fff",
            color: "#1d1d1d",
            outline: "none",
            boxShadow: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 3px ${zenGreen}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <option value="">Select an active requester</option>
          {requesters.map((requester) => (
            <option key={requester.id} value={requester.id}>
              {requester.name} ({requester.email})
            </option>
          ))}
        </select>
      )}

      {!loading && !error && requesters.length === 0 && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f6f8f7",
            color: "#444",
            border: "1px solid #dfe8e3",
          }}
        >
          No active requesters available.
        </div>
      )}

      {selectedId !== "" && !loading && !error && (
        <div style={{ marginTop: 10, color: zenGreen, fontWeight: 600 }}>
          Selected: {requesters.find((r) => r.id === selectedId)?.name ?? "Requester"}
        </div>
      )}
    </div>
  );
}
