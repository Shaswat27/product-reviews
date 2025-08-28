"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type TrendPoint = { week: string; themes: number };

export default function ThemeTrends({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly Overview</CardTitle>
        <CardDescription>Themes identified over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                stroke={`hsl(var(--muted-foreground))`}
                tick={{ fill: `hsl(var(--muted-foreground))`, fontSize: 12 }}
                axisLine={{ stroke: `hsl(var(--border))` }}
                tickLine={{ stroke: `hsl(var(--border))` }}
              />
              <YAxis
                stroke={`hsl(var(--muted-foreground))`}
                tick={{ fill: `hsl(var(--muted-foreground))`, fontSize: 12 }}
                axisLine={{ stroke: `hsl(var(--border))` }}
                tickLine={{ stroke: `hsl(var(--border))` }}
                tickCount={5}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line
                type="monotone"
                dataKey="themes"
                stroke={`hsl(var(--chart-1, var(--primary)))`}
                strokeWidth={2}
                dot={{ r: 3, stroke: `hsl(var(--chart-1, var(--primary)))`, fill: `hsl(var(--chart-1, var(--primary)))` }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}