import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;

  async function handleCheck() {
    // TODO(Issue 4): set loading, call checkSystem(), then either
    //   - success: store categories and show Online + the list, or
    //   - error: show Offline + a useful message.
    setState("loading");
    try {
      const res = await checkSystem();
      setCategories(res.categories ?? []);
      setState("success");
    } catch (err: any) {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && <div className="mt-3">Checking system…</div>}
      {state === "success" && (
        <div className="mt-3">
          <div className="alert alert-success">Online — TokTickIT API is reachable</div>
          <h2 className="h6">Categories</h2>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </div>
      )}
      {state === "error" && (
        <div className="mt-3">
          <div className="alert alert-danger">Offline — could not reach the TokTickIT API</div>
        </div>
      )}
    </div>
  );
}
