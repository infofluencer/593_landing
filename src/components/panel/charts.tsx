"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTrendPoint } from "@/lib/panel/presentation";

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: 8,
  fontSize: 12,
  color: "#18181b",
};

export function SpendTrendChart({ data }: { data: DailyTrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4285F4" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4285F4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gMeta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0668E1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0668E1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(24,24,27,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#71717a" }} />
          <Area
            type="monotone"
            dataKey="googleSpend"
            name="Google harcama"
            stroke="#4285F4"
            fill="url(#gGoogle)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="metaSpend"
            name="Meta harcama"
            stroke="#0668E1"
            fill="url(#gMeta)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConvTrendChart({ data }: { data: DailyTrendPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(24,24,27,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="googleConv"
            name="Google dönüşüm"
            fill="#4285F4"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="metaConv"
            name="Meta dönüşüm"
            fill="#0668E1"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MixPieChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  if (!data.length) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-zinc-500">
        Karşılaştırılacak harcama yok
      </p>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConversionPieChart({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  if (!data.length) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-zinc-500">
        Dönüşüm kırılımı yok
      </p>
    );
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignBarChart({
  data,
  color = "#0668E1",
}: {
  data: { name: string; harcama: number }[];
  color?: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="rgba(24,24,27,0.08)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="harcama" name="Harcama" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
