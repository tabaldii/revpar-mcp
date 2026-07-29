"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Sparkles,
  Send,
  Building2,
  DollarSign,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCall?: string;
}

interface MarketDataState {
  city: string;
  neighborhood: string;
  suggestedAdr: number;
  airbnbBaseAdr: number;
  hotelBaseAdr: number;
  revPar: number;
  occupancyRate: number;
  minStayDays: number;
  eventName?: string;
}

const initialMetrics: MarketDataState = {
  city: "Aguardando consulta",
  neighborhood: "Selecione uma localização",
  suggestedAdr: 0,
  airbnbBaseAdr: 0,
  hotelBaseAdr: 0,
  revPar: 0,
  occupancyRate: 0,
  minStayDays: 0,
  eventName: undefined,
};

export default function RevParDashboard() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<MarketDataState>(initialMetrics);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Olá! Sou o RevPar Intel Agent. Como posso ajudar com a estratégia de precificação dinâmica do seu imóvel hoje?",
    },
  ]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userQuery,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userQuery }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro na resposta da API.");
      }

      if (data.metrics) {
        setMetrics((prev) => ({ ...prev, ...data.metrics }));
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        toolCall:
          data.executedTools && data.executedTools.length > 0
            ? data.executedTools.join(" & ")
            : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error("Erro na comunicação com o agente:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Ocorreu um erro ao consultar o servidor MCP. Tente novamente.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = [
    { name: "Média Hotel", valor: metrics.hotelBaseAdr || 0, fill: "#6366f1" },
    { name: "Média Airbnb", valor: metrics.airbnbBaseAdr || 0, fill: "#a855f7" },
    { name: "Sugerido (Yield)", valor: metrics.suggestedAdr || 0, fill: "#10b981" },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Interface do Chat */}
      <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm">
                RevPar Intel Agent
              </h1>
              <p className="text-xs text-slate-400">
                MCP Protocol • OpenAI GPT-4o
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conectado ao MCP Server
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {msg.toolCall && (
                <div className="mb-1.5 px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ferramenta executada: {msg.toolCall}</span>
                </div>
              )}
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-none"
                    : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
              <span>Consultando inteligência de mercado...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-slate-800 bg-slate-900"
        >
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-emerald-500/50 transition">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre preços, ocupação ou eventos..."
              className="flex-1 bg-transparent text-sm focus:outline-none text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Painel do Dashboard */}
      <div className="w-1/2 p-6 overflow-y-auto space-y-6 bg-slate-950">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Visão Geral de Yield Management
            </h2>
            <p className="text-xs text-slate-400">
              {metrics.city} {metrics.neighborhood ? `— ${metrics.neighborhood}` : ""}
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            Moeda: BRL (R$)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">ADR Sugerida</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              R$ {metrics.suggestedAdr || 0}
            </p>
            <p className="text-[11px] text-slate-500">
              Tarifa diária otimizada para a janela
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">RevPAR Estimado</span>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-400">
              R$ {metrics.revPar || 0}
            </p>
            <p className="text-[11px] text-slate-500">
              Receita por quarto disponível
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Meta de Ocupação</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">
              {metrics.occupancyRate || 0}%
            </p>
            <p className="text-[11px] text-slate-500">Capacidade da região</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Estadia Mínima (LOS)</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">
              {metrics.minStayDays || 0} {metrics.minStayDays === 1 ? "noite" : "noites"}
            </p>
            <p className="text-[11px] text-slate-500">Restrição de mercado</p>
          </div>
        </div>

        {metrics.eventName && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <Building2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                Evento de Alto Impacto Detectado
              </h4>
              <p className="text-sm font-medium text-slate-200 mt-1">
                {metrics.eventName}
              </p>
            </div>
          </div>
        )}

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Comparativo de Tarifa Diária (ADR)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}