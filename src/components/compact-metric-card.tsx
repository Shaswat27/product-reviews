import { AlertTriangle, TrendingUp, Target, Award } from "lucide-react"

interface CompactMetricCardProps {
  title: string
  value: string | number
  type: "warning" | "info" | "success" | "primary"
  icon?: React.ReactNode
}

export function CompactMetricCard({ title, value, type, icon }: CompactMetricCardProps) {
  const getTypeStyles = () => {
    switch (type) {
      case "warning":
        return {
          color: "text-red-600",
          bg: "bg-red-50"
        }
      case "success":
        return {
          color: "text-emerald-600", 
          bg: "bg-emerald-50"
        }
      case "info":
        return {
          color: "text-blue-600",
          bg: "bg-blue-50"
        }
      case "primary":
        return {
          color: "text-primary",
          bg: "bg-primary/5"
        }
      default:
        return {
          color: "text-foreground",
          bg: "bg-muted"
        }
    }
  }

  const getIcon = () => {
    if (icon) return icon
    
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-4 h-4" />
      case "success":
        return <Target className="w-4 h-4" />
      case "info":
        return <TrendingUp className="w-4 h-4" />
      case "primary":
        return <Award className="w-4 h-4" />
      default:
        return null
    }
  }

  const styles = getTypeStyles()

  return (
    <div className="bg-card border border-border/50 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${styles.bg} flex items-center justify-center ${styles.color}`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`text-lg font-semibold ${styles.color}`}>
            {value}
          </div>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </div>
      </div>
    </div>
  )
}