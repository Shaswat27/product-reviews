import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { AlertTriangle, TrendingUp, Target, Award } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  type: "warning" | "info" | "success" | "primary"
  icon?: React.ReactNode
}

export function MetricCard({ title, value, type, icon }: MetricCardProps) {
  const getTypeStyles = () => {
    switch (type) {
      case "warning":
        return {
          color: "text-red-600",
          bg: "bg-gradient-to-br from-red-50 to-red-100/50",
          border: "border-red-200/50"
        }
      case "success":
        return {
          color: "text-emerald-600", 
          bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50",
          border: "border-emerald-200/50"
        }
      case "info":
        return {
          color: "text-blue-600",
          bg: "bg-gradient-to-br from-blue-50 to-blue-100/50", 
          border: "border-blue-200/50"
        }
      case "primary":
        return {
          color: "text-primary",
          bg: "bg-gradient-to-br from-primary/5 to-primary/10",
          border: "border-primary/20"
        }
      default:
        return {
          color: "text-foreground",
          bg: "bg-gradient-to-br from-muted to-muted/50",
          border: "border-border"
        }
    }
  }

  const getIcon = () => {
    if (icon) return icon
    
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-5 h-5" />
      case "success":
        return <Target className="w-5 h-5" />
      case "info":
        return <TrendingUp className="w-5 h-5" />
      case "primary":
        return <Award className="w-5 h-5" />
      default:
        return null
    }
  }

  const styles = getTypeStyles()

  return (
    <Card className={`
      hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 
      border ${styles.border} backdrop-blur-sm
      hover:scale-[1.02] hover:-translate-y-1
    `}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className={`
            w-12 h-12 rounded-xl ${styles.bg} 
            flex items-center justify-center ${styles.color}
            shadow-sm
          `}>
            {getIcon()}
          </div>
          
          <div className="space-y-2">
            <div className={`text-3xl font-semibold ${styles.color}`}>
              {value}
            </div>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}