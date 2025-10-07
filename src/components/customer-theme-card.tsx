"use client";
import { Card, CardContent, CardHeader } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

interface CustomerThemeCardProps {
  title: string
  description: string
  severity: "High" | "Medium" | "Low"
  evidenceCount: number
  recommendations: Array<{
    description: string;
    kind: "product" | "gtm";
    impact: number;
    effort: number;
  }>
}

export function CustomerThemeCard({ 
  title, 
  description, 
  severity, 
  evidenceCount,
  recommendations
}: CustomerThemeCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const getSeverityColor = () => {
    switch (severity) {
      case "High":
        return "bg-destructive text-destructive-foreground"
      case "Medium":
        return "bg-yellow-500 text-white"
      case "Low":
        return "bg-green-500 text-white"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  return (
    <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${getSeverityColor()} shadow-sm`}>{severity}</Badge>
            <div className="text-sm text-emerald-600 font-medium">
              {evidenceCount} Evidence Point{evidenceCount !== 1 ? 's' : ''}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 hover:bg-primary/10"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            <h4 className="font-medium text-primary">Recommended Actions</h4>
            <ul className="space-y-3">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex flex-col items-start gap-2 text-sm p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                    <span className="text-muted-foreground leading-relaxed">{rec.description}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-5 pt-1">
                    <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                      {rec.kind.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                      Impact: {rec.impact}/5 • Effort: {rec.effort}/5
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}