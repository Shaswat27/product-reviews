import { Button } from "./ui/button"
import { BarChart3, Settings, TrendingUp, X } from "lucide-react"

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentPage: string
  onNavigate: (page: string) => void
}

export function DashboardSidebar({ isOpen, onClose, currentPage, onNavigate }: DashboardSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 
        bg-gradient-to-b from-card to-card/80 backdrop-blur-xl
        border-r border-border/50 h-full flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-xl lg:shadow-none
      `}>
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">SignalLens</h1>
                <p className="text-sm text-muted-foreground">Product Insights</p>
              </div>
            </div>
            
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            <Button 
              variant={currentPage === 'dashboard' ? 'secondary' : 'ghost'}
              className={`w-full justify-start gap-3 ${
                currentPage === 'dashboard' 
                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/20 hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => onNavigate('dashboard')}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </Button>
            <Button 
              variant={currentPage === 'insights' ? 'secondary' : 'ghost'}
              className={`w-full justify-start gap-3 ${
                currentPage === 'insights' 
                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/20 hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => onNavigate('insights')}
            >
              <TrendingUp className="w-4 h-4" />
              Insights
            </Button>
            <Button 
              variant={currentPage === 'settings' ? 'secondary' : 'ghost'}
              className={`w-full justify-start gap-3 ${
                currentPage === 'settings' 
                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/20 hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => onNavigate('settings')}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </nav>
        </div>
      </div>
    </>
  )
}