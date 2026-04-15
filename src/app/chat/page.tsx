"use client"

import React, { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { MessageSquare, Plus, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAppData } from '@/components/AppDataProvider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { NativeChat } from '@/components/chat/NativeChat'

const WidgetBot = dynamic(() => import('@widgetbot/react-embed'), { ssr: false })

export default function ChatPage() {
  const { team } = useAppData()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      toast.error("Please enter a channel name")
      return
    }

    setIsSubmitting(true)
    try {
      // Discord forces lowercase and no spaces for text channels
      const formatName = channelName.toLowerCase().replace(/\s+/g, '-')
      
      const response = await fetch('/api/discord/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formatName,
          // Using the user's hardcoded server ID for this request
          guildId: "1491986985680765150", 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create channel')
      }

      toast.success(`Channel #${formatName} successfully created!`)
      setChannelName('')
      setIsDialogOpen(false)
      
      // Note: The WidgetBot frame does not expose a frontend refresh method natively,
      // so the user might need to reload the page or click a different channel to see it pop up.
      
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout pageTitle="Team Chat" pageIcon={MessageSquare}>
      <Tabs defaultValue="discord" className="flex flex-col gap-4 h-full">
        <div className="bg-muted p-4 rounded-lg border shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare size={20} />
              {team?.team_name ? `${team.team_name} Connect` : 'Team Connect'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Communicate with your team natively via TeamForge DMs, or explore your integrated Discord servers.
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <TabsList>
              <TabsTrigger value="discord">Team Discord</TabsTrigger>
              <TabsTrigger value="dms">Teamforge DMs and chats</TabsTrigger>
            </TabsList>
            
            {/* Create Discord Channel Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 flex items-center gap-2">
                  <Plus size={16} />
                  New Discord Channel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Discord Channel</DialogTitle>
                  <DialogDescription>
                    This will instantly create a new text channel on your Discord server using the Discord API.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Channel Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. general-discussion"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateChannel()
                      }}
                    />
                    <span className="text-xs text-muted-foreground mt-1">
                      Names will be automatically lowercased and spaces replaced with hyphens by Discord.
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateChannel} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Create Channel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <TabsContent value="discord" className="flex-1 w-full rounded-xl overflow-hidden shadow-md border min-h-[600px] bg-[#36393f] m-0">
          <WidgetBot
            server="1491986985680765150"
            channel="1491986986138075147"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </TabsContent>

        <TabsContent value="dms" className="flex-1 w-full rounded-xl overflow-hidden shadow-md border bg-background m-0 min-h-[600px]">
          <NativeChat />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
