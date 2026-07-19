"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  Ticket,
  ArrowLeftRight,
  Plus,
  ExternalLink,
  Check,
  X,
  Loader2,
  Coins,
  RefreshCw,
} from "lucide-react";

const COOLDOWN_MS = 15000;
const FIXED_POINTS = { sub: 3, view: 1 };

function Perforation({ side }) {
  return (
    <div className={`perforation ${side === "left" ? "-left-[7px]" : "-right-[7px]"}`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="perforation-dot" />
      ))}
    </div>
  );
}

function fmtType(t) {
  return t === "sub" ? "Abonnement" : "Vue";
}

export default function Page() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState("browse");
  const [requests, setRequests] = useState([]);
  const [myCompletedIds, setMyCompletedIds] = useState(new Set());
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({ link: "", type: "sub", count: 5 });
  const [formError, setFormError] = useState("");
  const [posting, setPosting] = useState(false);

  const [completing, setCompleting] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data, error: err } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (err) {
      setError("Impossible de charger ton profil.");
      return;
    }
    setProfile(data);
  }, []);

  const loadRequests = useCallback(async (userId) => {
    setRefreshing(true);
    try {
      const { data: reqs, error: reqErr } = await supabase
        .from("requests")
        .select("*")
        .gt("remaining", 0)
        .order("created_at", { ascending: false });
      if (reqErr) throw reqErr;
      setRequests(reqs || []);

      const { data: comps, error: compErr } = await supabase
        .from("completions")
        .select("request_id")
        .eq("user_id", userId);
      if (compErr) throw compErr;
      setMyCompletedIds(new Set((comps || []).map((c) => c.request_id)));
    } catch (e) {
      console.error(e);
      setError("Impossible de charger les demandes pour le moment.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadProfile(session.user.id);
      loadRequests(session.user.id);
    } else {
      setProfile(null);
    }
  }, [session, loadProfile, loadRequests]);

  const signUp = async () => {
    setAuthError("");
    if (!email.trim() || !password || !usernameInput.trim()) {
      setAuthError("Remplis tous les champs.");
      return;
    }
    setAuthLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: usernameInput.trim() } },
    });
    setAuthLoading(false);
    if (err) {
      setAuthError(err.message);
      return;
    }
    setAuthError("Compte créé. Si la confirmation par e-mail est activée, vérifie ta boîte mail avant de te connecter.");
  };

  const logIn = async () => {
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("Renseigne ton e-mail et ton mot de passe.");
      return;
    }
    setAuthLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthLoading(false);
    if (err) {
      setAuthError("Connexion impossible : " + err.message);
    }
  };

  const logOut = async () => {
    await supabase.auth.signOut();
  };

  const publish = async () => {
    setFormError("");
    if (!form.link.trim().startsWith("http")) {
      setFormError("Colle un lien valide (commençant par http).");
      return;
    }
    const ppa = FIXED_POINTS[form.type];
    const count = Number(form.count);
    if (!count || count < 1) {
      setFormError("Indique un nombre d'actions valide.");
      return;
    }
    setPosting(true);
    const { error: err } = await supabase.rpc("create_request", {
      p_link: form.link.trim(),
      p_type: form.type,
      p_points_per_action: ppa,
      p_count: count,
    });
    setPosting(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setForm({ link: "", type: "sub", count: 5 });
    await loadProfile(session.user.id);
    await loadRequests(session.user.id);
    setTab("mine");
  };

  const markDone = async (req) => {
    if (cooldownLeft > 0) return;
    setCompleting(req.id);
    const { error: err } = await supabase.rpc("complete_request", { p_request_id: req.id });
    setCompleting(null);
    if (err) {
      setError(err.message);
      return;
    }
    setCooldownUntil(Date.now() + COOLDOWN_MS);
    await loadProfile(session.user.id);
    await loadRequests(session.user.id);
  };

  const cancelRequest = async (req) => {
    const { error: err } = await supabase.rpc("cancel_request", { p_request_id: req.id });
    if (err) {
      setError(err.message);
      return;
    }
    await loadProfile(session.user.id);
    await loadRequests(session.user.id);
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-inksoft" size={28} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="relative bg-white border border-line rounded max-w-sm w-full p-7">
          <Perforation side="left" />
          <Perforation side="right" />
          <div className="flex justify-center mb-1">
            <Ticket size={28} className="text-amberdark" />
          </div>
          <h1 className="font-display font-bold text-3xl text-center text-ink tracking-wide mb-1">
            LE COMPTOIR D'ÉCHANGE
          </h1>
          <p className="text-center text-inksoft text-sm mb-5">
            Des points contre des abonnés et des vues. Toi pour eux, eux pour toi.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded text-sm font-display font-bold tracking-wide border ${
                mode === "login" ? "bg-teal text-white border-teal" : "bg-white text-ink border-line"
              }`}
            >
              CONNEXION
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded text-sm font-display font-bold tracking-wide border ${
                mode === "signup" ? "bg-teal text-white border-teal" : "bg-white text-ink border-line"
              }`}
            >
              INSCRIPTION
            </button>
          </div>

          {mode === "signup" && (
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Pseudo"
              className="w-full px-3 py-3 border border-line rounded text-sm mb-3 bg-paper"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            type="email"
            className="w-full px-3 py-3 border border-line rounded text-sm mb-3 bg-paper"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            type="password"
            onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? logIn() : signUp())}
            className="w-full px-3 py-3 border border-line rounded text-sm mb-3 bg-paper"
          />

          <button
            onClick={mode === "login" ? logIn : signUp}
            disabled={authLoading}
            className="w-full py-3 bg-amber text-white rounded font-display font-bold text-lg tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeftRight size={18} />}
            {mode === "login" ? "SE CONNECTER" : "CRÉER MON COMPTE — 50 points offerts"}
          </button>

          {authError && <p className="text-red text-sm mt-3 text-center">{authError}</p>}
        </div>
      </div>
    );
  }

  const own = requests.filter((r) => r.user_id === session.user.id);
  const others = requests.filter((r) => r.user_id !== session.user.id);
  const list = tab === "browse" ? others : own;

  return (
    <div className="min-h-screen">
      <div className="bg-ink text-paper px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket size={20} className="text-amber" />
          <span className="font-display font-bold text-xl tracking-wide">COMPTOIR D'ÉCHANGE</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded font-mono text-sm">
            <Coins size={14} className="text-amber" />
            {profile?.points ?? "…"}
          </div>
          <button onClick={logOut} className="text-xs opacity-70">
            {profile?.username || session.user.email} · quitter
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 pb-16">
        <div className="flex gap-2 mb-4">
          {[
            ["browse", "Réaliser"],
            ["mine", "Mes demandes"],
            ["publish", "Publier"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded font-display font-semibold text-sm tracking-wide border ${
                tab === key ? "bg-teal text-white border-teal" : "bg-white text-ink border-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red/10 text-red px-3 py-2 rounded text-sm mb-3">{error}</div>
        )}

        {tab === "publish" ? (
          <div className="bg-white border border-line rounded p-5">
            <h2 className="font-display font-bold text-2xl text-ink mb-3">Publier une demande</h2>

            <label className="text-xs text-inksoft font-semibold">LIEN DE LA CHAÎNE OU VIDÉO</label>
            <input
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://youtube.com/..."
              className="w-full px-3 py-2.5 border border-line rounded text-sm my-1.5 mb-3"
            />

            <label className="text-xs text-inksoft font-semibold">TYPE D'ACTION</label>
            <div className="flex gap-2 my-1.5 mb-3">
              {["sub", "view"].map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 rounded text-sm border ${
                    form.type === t ? "bg-amber text-white border-amberdark" : "bg-white text-ink border-line"
                  }`}
                >
                  {fmtType(t)}
                </button>
              ))}
            </div>

            <p className="text-sm text-inksoft mb-3">
              Prix fixe : <strong className="font-mono text-ink">{FIXED_POINTS[form.type]} point{FIXED_POINTS[form.type] > 1 ? "s" : ""}</strong> par {fmtType(form.type).toLowerCase()}, le même pour tout le monde.
            </p>

            <label className="text-xs text-inksoft font-semibold">NB D'ACTIONS SOUHAITÉES</label>
            <input
              type="number"
              min={1}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
              className="w-full px-3 py-2.5 border border-line rounded mt-1.5 mb-3 font-mono"
            />

            <p className="text-sm text-inksoft mb-3">
              Coût total :{" "}
              <strong className="font-mono text-ink">
                {FIXED_POINTS[form.type] * (Number(form.count) || 0)} points
              </strong>{" "}
              (débités immédiatement, remboursés si tu annules)
            </p>

            {formError && <p className="text-red text-sm mb-2.5">{formError}</p>}

            <button
              onClick={publish}
              disabled={posting}
              className="w-full py-3 bg-teal text-white rounded font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Publier la demande
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => loadRequests(session.user.id)}
                className="text-inksoft text-xs flex items-center gap-1"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                actualiser
              </button>
            </div>

            {list.length === 0 && (
              <p className="text-center text-inksoft text-sm py-8">
                {tab === "browse" ? "Aucune demande disponible pour l'instant." : "Tu n'as encore rien publié."}
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              {list.map((req) => {
                const done = myCompletedIds.has(req.id);
                return (
                  <div key={req.id} className="bg-white border border-line rounded px-4 py-3.5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`font-display font-bold text-xs tracking-wide text-white px-2 py-0.5 rounded ${
                              req.type === "sub" ? "bg-teal" : "bg-amberdark"
                            }`}
                          >
                            {fmtType(req.type).toUpperCase()}
                          </span>
                          <span className="font-mono text-sm text-ink">{req.points_per_action} pts</span>
                        </div>
                        <a
                          href={req.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal break-all"
                        >
                          {req.link} <ExternalLink size={11} className="inline -translate-y-px" />
                        </a>
                        <div className="text-xs text-inksoft mt-1">
                          {req.remaining}/{req.total_count} restants
                        </div>
                      </div>
                      {tab === "browse" ? (
                        <button
                          onClick={() => markDone(req)}
                          disabled={done || completing === req.id || cooldownLeft > 0}
                          className={`shrink-0 px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 ${
                            done || cooldownLeft > 0
                              ? "bg-line/40 text-inksoft"
                              : "bg-amber text-white"
                          }`}
                        >
                          {completing === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : done ? (
                            <Check size={14} />
                          ) : null}
                          {done ? "Fait" : cooldownLeft > 0 ? `Patiente ${cooldownLeft}s` : "J'ai terminé"}
                        </button>
                      ) : (
                        <button
                          onClick={() => cancelRequest(req)}
                          className="shrink-0 px-2.5 py-2 rounded text-xs border border-red text-red flex items-center gap-1"
                        >
                          <X size={13} /> Annuler
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
        }
