import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Calendar,
  Plus,
  Search,
  ChevronLeft,
  MapPin,
  Clock,
  Users,
  CalendarCheck,
  CalendarX,
  Globe,
  Lock,
  Coins,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// API functions for events
const eventsAPI = {
  getEvents: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/events/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load events");
    return res.json();
  },
  
  getMyEvents: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/events/my-events/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load my events");
    return res.json();
  },
  
  createEvent: async (data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/events/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create event");
    }
    return res.json();
  },
  
  rsvpEvent: async (eventId, status) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to RSVP");
    return res.json();
  },
};

// Format date for display
const formatEventDate = (dateStr) => {
  const date = new Date(dateStr);
  return {
    day: date.getDate(),
    month: date.toLocaleString("default", { month: "short" }),
    time: date.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" }),
    full: date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  };
};

// Event Card Component
const EventCard = ({ event, onRsvp, myRsvp, isOrganizer }) => {
  const dateInfo = formatEventDate(event.start_date);
  const isPast = new Date(event.start_date) < new Date();
  
  return (
    <div className={`bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all ${isPast ? 'opacity-60' : ''}`}>
      {/* Cover Image */}
      <div className="h-32 bg-gradient-to-br from-purple-500 to-pink-600 relative">
        {event.cover_image && (
          <img src={event.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        {/* Date Badge */}
        <div className="absolute top-3 left-3 bg-white rounded-lg p-2 text-center shadow-lg">
          <div className="text-xl font-bold text-primary">{dateInfo.day}</div>
          <div className="text-xs text-muted-foreground uppercase">{dateInfo.month}</div>
        </div>
        {isPast && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-black/60 px-3 py-1 rounded-full text-white text-sm">Past Event</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-2">{event.name}</h3>
          {isOrganizer && (
            <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full shrink-0">
              Organizer
            </span>
          )}
        </div>
        
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{dateInfo.time}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{event.going_count || 0} going • {event.interested_count || 0} interested</span>
          </div>
        </div>
        
        {!isPast && (
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant={myRsvp === "going" ? "default" : "outline"}
              className={`flex-1 ${myRsvp === "going" ? "bg-green-600 hover:bg-green-700" : ""}`}
              onClick={() => onRsvp(event.event_id, "going")}
            >
              <CalendarCheck className="w-4 h-4 mr-1" />
              {myRsvp === "going" ? "Going" : "I'm Going"}
            </Button>
            <Button
              size="sm"
              variant={myRsvp === "interested" ? "default" : "outline"}
              className={`flex-1 ${myRsvp === "interested" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              onClick={() => onRsvp(event.event_id, "interested")}
            >
              <Calendar className="w-4 h-4 mr-1" />
              {myRsvp === "interested" ? "Interested" : "Maybe"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Create Event Modal
const CreateEventModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
    privacy: "public",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.start_date) {
      toast.error("Event name and start date are required");
      return;
    }
    
    setLoading(true);
    try {
      await onCreate(formData);
      toast.success("Event created! +20 BL Coins");
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border my-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" /> Create Event
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Event Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="What's the event called?"
              data-testid="event-name-input"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell people about your event"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Where is it happening?"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Date *</label>
              <Input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <Input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Privacy</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, privacy: "public" })}
                className={`flex-1 p-3 rounded-lg border ${
                  formData.privacy === "public" ? "border-primary bg-primary/10" : "border-border"
                } flex items-center justify-center gap-2`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, privacy: "private" })}
                className={`flex-1 p-3 rounded-lg border ${
                  formData.privacy === "private" ? "border-primary bg-primary/10" : "border-border"
                } flex items-center justify-center gap-2`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
            </div>
          </div>
          
          <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="text-sm">Creating an event earns you <strong>20 BL Coins!</strong></span>
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1" data-testid="create-event-submit">
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Events() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [myRsvps, setMyRsvps] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allEvents, userEvents] = await Promise.all([
        eventsAPI.getEvents().catch(() => []),
        eventsAPI.getMyEvents().catch(() => ({ created: [], attending: [], rsvps: {} })),
      ]);
      setEvents(allEvents);
      setMyEvents(userEvents.created || []);
      setMyRsvps(userEvents.rsvps || {});
    } catch (error) {
      console.error("Failed to load events:", error);
    }
    setLoading(false);
  };

  const handleCreateEvent = async (data) => {
    const result = await eventsAPI.createEvent(data);
    loadData();
    return result;
  };

  const handleRsvp = async (eventId, status) => {
    try {
      await eventsAPI.rsvpEvent(eventId, status);
      setMyRsvps(prev => ({ ...prev, [eventId]: prev[eventId] === status ? null : status }));
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const now = new Date();
  const upcomingEvents = events.filter(e => new Date(e.start_date) >= now);
  const pastEvents = events.filter(e => new Date(e.start_date) < now);
  const organizerEventIds = myEvents.map(e => e.event_id);

  const filteredEvents = searchQuery 
    ? events.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : (activeTab === "upcoming" ? upcomingEvents : activeTab === "past" ? pastEvents : myEvents);

  return (
    <div className="min-h-screen bg-background" data-testid="events-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Events
          </h1>
          <Button size="sm" className="ml-auto" onClick={() => setShowCreateModal(true)} data-testid="create-event-btn">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: "upcoming", label: "Upcoming", count: upcomingEvents.length },
            { id: "past", label: "Past", count: pastEvents.length },
            { id: "my-events", label: "My Events", count: myEvents.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
              className={`py-2 px-4 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? "No events match your search" : "No events found"}
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create an Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.event_id}
                event={event}
                onRsvp={handleRsvp}
                myRsvp={myRsvps[event.event_id]}
                isOrganizer={organizerEventIds.includes(event.event_id)}
              />
            ))}
          </div>
        )}

        {/* Create Event CTA */}
        <div className="mt-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" /> Host Your Own Event
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create events for meetups, parties, workshops, or any occasion. Earn 20 BL Coins for each event you create!
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Event
          </Button>
        </div>
      </main>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateEvent}
        />
      )}
    </div>
  );
}
