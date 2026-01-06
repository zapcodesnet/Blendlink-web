import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { ArrowLeft, Image, X, Send } from "lucide-react";

export default function CreatePost() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isStory = location.state?.isStory || false;
  
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) {
      toast.error("Please add some content");
      return;
    }

    setLoading(true);
    try {
      await api.posts.createPost({ content, images, is_story: isStory });
      toast.success(isStory ? "Story posted!" : "Post created!");
      navigate("/feed");
    } catch (error) {
      toast.error(error.message || "Social features coming soon to mobile API");
    } finally {
      setLoading(false);
    }
  };

  const addImageUrl = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      setImages([...images, url]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold">{isStory ? "New Story" : "New Post"}</h1>
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (!content.trim() && images.length === 0)}
            className="rounded-full"
            data-testid="post-submit-btn"
          >
            {loading ? "Posting..." : "Post"}
            <Send className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Content */}
        <Textarea
          placeholder={isStory ? "Share a moment..." : "What's on your mind?"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[150px] border-none text-lg resize-none focus-visible:ring-0"
          data-testid="post-content"
        />

        {/* Images */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {images.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={addImageUrl}>
            <Image className="w-4 h-4 mr-2" />
            Add Image
          </Button>
        </div>

        {isStory && (
          <p className="text-sm text-muted-foreground mt-4">
            Stories disappear after 24 hours
          </p>
        )}

        {/* Note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Note: Social features are being added to the mobile API
        </p>
      </main>
    </div>
  );
}
