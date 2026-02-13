/**
 * Team Members Manager Component
 * Allows page owners to add/remove authorized users who can manage their page
 */
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Users, UserPlus, Trash2, Mail, Shield, Crown, Loader2, X, Check
} from "lucide-react";
import { getApiUrl } from "../../utils/runtimeConfig";

const API_URL = getApiUrl();

export default function TeamMembersManager({ pageId, isOwner }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    loadTeamMembers();
  }, [pageId]);

  const loadTeamMembers = async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const data = await safeFetch(`${API_URL}/api/member-pages/${pageId}/team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(data.team_members || []);
    } catch (err) {
      console.error("Failed to load team members:", err);
      toast.error("Failed to load team members");
    }
    setLoading(false);
  };

  const addTeamMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setAdding(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const data = await safeFetch(`${API_URL}/api/member-pages/${pageId}/team`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: newMemberEmail.toLowerCase() })
      });
      
      setTeamMembers(prev => [...prev, data.team_member]);
      setNewMemberEmail("");
      toast.success(data.message || "Team member added!");
    } catch (err) {
      toast.error(err.message || "Failed to add team member");
    }
    setAdding(false);
  };

  const removeTeamMember = async (userId) => {
    if (!confirm("Remove this team member? They will lose access to manage this page.")) {
      return;
    }

    setRemovingId(userId);
    try {
      const token = localStorage.getItem('blendlink_token');
      await safeFetch(`${API_URL}/api/member-pages/${pageId}/team/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTeamMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success("Team member removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove team member");
    }
    setRemovingId(null);
  };

  if (!isOwner) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <Shield className="w-10 h-10 mx-auto text-amber-500 mb-2" />
        <p className="text-amber-800 font-medium">Only page owners can manage team members</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-members-manager">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500">Add people who can manage this page</p>
        </div>
      </div>

      {/* Add New Member Form */}
      <form onSubmit={addTeamMember} className="flex gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="email"
            placeholder="Enter team member's email..."
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            className="pl-11 h-11 rounded-xl border-gray-200"
            disabled={adding}
            data-testid="add-member-email-input"
          />
        </div>
        <Button
          type="submit"
          disabled={adding || !newMemberEmail.trim()}
          className="h-11 px-5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
          data-testid="add-member-button"
        >
          {adding ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-5 h-5 mr-2" /> Add
            </>
          )}
        </Button>
      </form>

      {/* Team Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-2xl">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No team members yet</p>
          <p className="text-sm text-gray-400 mt-1">Add team members to help manage this page</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Owner indicator */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">You (Owner)</p>
              <p className="text-sm text-amber-600">Full access to all page features</p>
            </div>
          </div>

          {/* Team members */}
          {teamMembers.map((member) => (
            <div 
              key={member.user_id}
              className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-shadow"
              data-testid={`team-member-${member.user_id}`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                {(member.name || member.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{member.name || "Team Member"}</p>
                <p className="text-sm text-gray-500 truncate">{member.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTeamMember(member.user_id)}
                disabled={removingId === member.user_id}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                data-testid={`remove-member-${member.user_id}`}
              >
                {removingId === member.user_id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Permissions Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 mb-2">Team Member Permissions</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-500" /> Access POS terminal and process transactions
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-500" /> View orders and analytics
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-500" /> Manage products, menu items, and inventory
          </li>
          <li className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400" /> Cannot delete the page
          </li>
          <li className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-400" /> Cannot add or remove team members
          </li>
        </ul>
      </div>
    </div>
  );
}
