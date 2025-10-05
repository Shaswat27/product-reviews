"use client";
import { Card, CardContent, CardHeader } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { ChevronDown, TrendingUp } from "lucide-react"
import { useState } from "react"

interface CustomerThemeCardProps {
  title: string
  description: string
  severity: "High" | "Medium" | "Low"
  trend: string
  recommendations: string[]
  impact: string
  effort: string
}

export function CustomerThemeCard({ 
  title, 
  description, 
  severity, 
  trend, 
  recommendations,
  impact,
  effort 
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
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              {trend}
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
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Recommended Actions</h4>
              <ul className="space-y-3">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                    <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                    <span className="text-muted-foreground leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
              <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                PRODUCT
              </Badge>
              <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                Impact: {impact} • Effort: {effort}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}