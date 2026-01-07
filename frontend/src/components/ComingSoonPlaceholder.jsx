import React from "react";
import { Clock } from "lucide-react";

const ComingSoonPlaceholder = ({ 
  icon: Icon,
  title = "Coming Soon",
  description = "This feature is coming soon"
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon ? (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      
      <p className="text-muted-foreground max-w-sm">
        {description}
      </p>
    </div>
  );
};

export default ComingSoonPlaceholder;
