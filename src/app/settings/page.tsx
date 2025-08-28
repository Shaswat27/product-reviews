import { User, Database, Bell, Shield, Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Settings() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold text-[hsl(var(--primary))]">Settings</h1>
        <p className="body-ink -mt-1">
          Manage your account and configure data sources
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="card-3d stat-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Account Information</span>
              </CardTitle>
              <CardDescription>Update your profile and account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    defaultValue="founder@company.com" 
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    defaultValue="Alex Johnson" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input 
                  id="company" 
                  type="text" 
                  defaultValue="CustomerVoice Inc." 
                />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card className="card-3d stat-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Data Sources</span>
              </CardTitle>
              <CardDescription>
                Connect review platforms to automatically ingest customer feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <DataSourceCard 
                  name="Trustpilot"
                  description="Import reviews from your Trustpilot business profile"
                  status="coming-soon"
                />
                <DataSourceCard 
                  name="G2"
                  description="Sync product reviews and ratings from G2 Crowd"
                  status="coming-soon"
                />
                <DataSourceCard 
                  name="App Store Connect"
                  description="Monitor mobile app reviews from iOS App Store"
                  status="coming-soon"
                />
                <DataSourceCard 
                  name="Google Play Console"
                  description="Track Android app reviews and user feedback"
                  status="coming-soon"
                />
                <DataSourceCard 
                  name="Zendesk"
                  description="Analyze support tickets and customer interactions"
                  status="coming-soon"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm font-medium">Custom API Integration</p>
                  <p className="text-xs text-muted-foreground">Connect your own review data via API</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Custom Source
                  <Badge variant="secondary" className="ml-2">Soon</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          <Card className="card-3d">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Reports</p>
                  <p className="text-xs text-muted-foreground">Weekly insight summaries</p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Critical Alerts</p>
                  <p className="text-xs text-muted-foreground">Urgent customer issues</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme Updates</p>
                  <p className="text-xs text-muted-foreground">New patterns detected</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card className="card-3d">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" className="w-full">
                Change Password
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Two-Factor Auth
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                API Keys
              </Button>
            </CardContent>
          </Card>

          <Card className="card-3d">
            <CardHeader>
              <CardTitle>Plan & Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Reviews Processed</span>
                  <span className="text-sm font-medium">1,247 / 5,000</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Upgrade Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface DataSourceCardProps {
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'coming-soon';
}

function DataSourceCard({ name, description, status }: DataSourceCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{name}</p>
          {status === 'coming-soon' && (
            <Badge variant="secondary">Coming Soon</Badge>
          )}
          {status === 'connected' && (
            <Badge variant="default" className="bg-success">Connected</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Button 
        variant="outline" 
        size="sm"
        disabled={status === 'coming-soon'}
      >
        {status === 'coming-soon' ? (
          'Coming Soon'
        ) : status === 'connected' ? (
          'Configure'
        ) : (
          <>
            <ExternalLink className="h-3 w-3 mr-1" />
            Connect
          </>
        )}
      </Button>
    </div>
  );
}