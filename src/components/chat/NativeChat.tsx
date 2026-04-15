"use client"

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useAppData } from '@/components/AppDataProvider'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Hash, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DBTeamMember {
  id: string
  user_id: string
  first_name: string
  last_name: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export function NativeChat() {
  const { user } = useAuth()
  const { team, teamMembers } = useAppData()
  
  const [selectedUser, setSelectedUser] = useState<DBTeamMember | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Filter out the current user and apply search query
  const availableUsers = teamMembers.filter((m: any) => 
    m.user_id !== user?.id && 
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Auto scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Subscribing to realtime messages
  useEffect(() => {
    if (!activeConversationId) return

    const channel = supabase
      .channel(`conversation-${activeConversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `conversation_id=eq.${activeConversationId}`
      }, (payload) => {
         setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConversationId])

  // Select a user to chat with - get or create conversation
  const handleSelectUser = async (targetUser: any) => {
    setSelectedUser(targetUser)
    setLoading(true)
    setMessages([])
    
    try {
      // Find existing conversation between the two users
      const { data: participationRecord } = await supabase
        .rpc('get_or_create_dm_conversation', {
            partner_user_id: targetUser.user_id,
            requesting_team_id: team?.id
        })
        .single()
        
      // RPC is ideal, but if we don't have it, we do it client-side.
      
      // We will do it locally using standard queries since RPC isn't built.
      
      // 1. Get all conversations the current user is in
      const { data: myConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user!.id)

      const myConvIds = myConversations?.map(c => c.conversation_id) || []
      
      let foundConversationId = null
      
      if (myConvIds.length > 0) {
        // 2. Check if the target user is in any of those conversation IDs
        const { data: shared } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', targetUser.user_id)
          .in('conversation_id', myConvIds)
          .limit(1)
          
        if (shared && shared.length > 0) {
          foundConversationId = shared[0].conversation_id
        }
      }
      
      // 3. If none found, create a new one!
      if (!foundConversationId) {
        // Create conversation
        const { data: newConv, error: newConvErr } = await supabase
          .from('conversations')
          .insert({ team_id: team!.id })
          .select('id')
          .single()
          
        if (newConvErr) throw newConvErr
        foundConversationId = newConv.id
        
        // Add both participants
        await supabase
          .from('conversation_participants')
          .insert([
            { conversation_id: foundConversationId, user_id: user!.id },
            { conversation_id: foundConversationId, user_id: targetUser.user_id },
          ])
      }
      
      setActiveConversationId(foundConversationId)
      
      // Load historical messages
      const { data: history } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', foundConversationId)
        .order('created_at', { ascending: true })
        
      if (history) setMessages(history)
      
    } catch (err) {
      console.error("Error setting up chat:", err)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !activeConversationId || !user) return
    
    const payload = {
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: messageInput.trim()
    }
    
    // Clear the input instantly for UX
    setMessageInput('') 
    
    const { error } = await supabase
      .from('direct_messages')
      .insert(payload)
      
    if (error) {
      console.error("Failed to send message", error)
    }
  }

  return (
    <div className="flex h-full w-full">
      {/* Left Sidebar - Contacts List */}
      <div className="w-64 border-r bg-muted/30 flex flex-col h-[600px]">
        <div className="p-4 border-b shrink-0">
          <Input 
            placeholder="Search team..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {availableUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No other team members found.</p>
          ) : (
             availableUsers.map((member: any) => (
              <button 
                key={member.id}
                onClick={() => handleSelectUser(member)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 text-left",
                  selectedUser?.user_id === member.user_id ? "bg-accent text-accent-foreground font-medium" : "text-foreground"
                )}
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {member.first_name[0]}{member.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm truncate leading-tight">{member.first_name} {member.last_name}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Chat View */}
      <div className="flex-1 flex flex-col h-[600px] bg-background">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground w-full">
            <Hash size={48} className="mb-4 opacity-20" />
            <p>Select a team member to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat Window Header */}
            <div className="h-14 border-b flex items-center px-6 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 w-full space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="font-semibold">{selectedUser.first_name} {selectedUser.last_name}</div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 max-w-full"
            >
              {loading ? (
                <div className="flex w-full items-center justify-center p-8 text-muted-foreground">
                   <Loader2 className="animate-spin w-6 h-6 mr-3" /> Loading history...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Avatar className="w-16 h-16 mb-4">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-xl font-semibold mb-2">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-[300px]">
                    This is the beginning of your direct message history with {selectedUser.first_name}. Say hello!
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user?.id
                  return (
                    <div key={msg.id || i} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "px-4 py-2 rounded-2xl max-w-[80%]",
                        isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-sm" 
                          : "bg-muted text-foreground border rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background shrink-0 w-full">
              <form 
                onSubmit={sendMessage}
                className="flex items-center gap-2 bg-muted p-1 px-2 rounded-full border shadow-sm focus-within:ring-1 ring-primary/50"
              >
                <Input 
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder={`Message ${selectedUser.first_name}...`}
                  className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 w-full"
                  disabled={loading}
                  autoComplete="off"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="rounded-full shrink-0 w-8 h-8"
                  disabled={!messageInput.trim() || loading}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
