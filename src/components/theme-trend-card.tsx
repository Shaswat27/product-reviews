// components/theme-trend-card.tsx

import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Type definition for a single theme's trend data.
 */
export type ThemeTrend = {
  name: string;
  description: string;
  current_severity: "High" | "Medium" | "Low";
  delta_reviews: number;
};

/**
 * Helper function to determine badge color variant based on severity.
 */
const getSeverityVariant = (
  severity: ThemeTrend["current_severity"]
): "destructive" | "default" | "secondary" => {
  switch (severity) {
    case "High":
      return "destructive";
    case "Medium":
      return "default"; // Assumes 'default' is your yellow/orange variant
    case "Low":
      return "secondary"; // Assumes 'secondary' is your green/blue variant
    default:
      return "secondary";
  }
};

/**
 * A reusable card to display quarter-over-quarter theme trends.
 */
export function ThemeTrendCard({ theme }: { theme: ThemeTrend }) {
  const isWorsening = theme.delta_reviews > 0;
  const isImproving = theme.delta_reviews < 0;
  const deltaText = isWorsening
    ? `+${theme.delta_reviews}`
    : `${theme.delta_reviews}`;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>{theme.name}</CardTitle>
        <CardDescription>{theme.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={getSeverityVariant(theme.current_severity)}>
            {theme.current_severity} Severity
          </Badge>
          <div
            className={`flex items-center text-lg font-bold ${
              isWorsening ? "text-red-500" : ""
            } ${isImproving ? "text-green-500" : ""}`}
          >
            {isWorsening && <ArrowUp className="h-5 w-5 mr-1" />}
            {isImproving && <ArrowDown className="h-5 w-5 mr-1" />}
            <span>{deltaText}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          QoQ change in related reviews
        </p>
      </CardContent>
      <CardFooter>
        {/* This button serves as a placeholder link to a future details page */}
        <Button variant="outline" className="w-full">
          View Action Plan
        </Button>
      </CardFooter>
    </Card>
  );
}