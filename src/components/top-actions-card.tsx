import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

interface ActionItem {
  title: string
  description: string
  priority?: "high" | "medium" | "low"
}

interface TopActionsCardProps {
  title: string
  subtitle: string
  actions: ActionItem[]
}

export function TopActionsCard({ title, subtitle, actions }: TopActionsCardProps) {
  return (
    <Card className="h-fit hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {actions.map((action, index) => (
            <div key={index} className="group flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 hover:from-primary/5 hover:to-primary/10 transition-all duration-200 border border-transparent hover:border-primary/20">
              <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full mt-2 flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform" />
              <div className="space-y-2">
                <p className="text-sm font-medium leading-tight text-foreground group-hover:text-primary/90 transition-colors">{action.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}