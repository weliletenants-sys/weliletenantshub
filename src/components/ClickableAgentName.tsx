import { useNavigate } from "react-router-dom";
import { haptics } from "@/utils/haptics";
import { cn } from "@/lib/utils";

interface ClickableAgentNameProps {
  agentId: string;
  agentName: string;
  className?: string;
  showUnderline?: boolean;
}

export function ClickableAgentName({ 
  agentId, 
  agentName, 
  className,
  showUnderline = true 
}: ClickableAgentNameProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    navigate(`/manager/agents/${agentId}`);
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer hover:text-primary transition-colors font-medium",
        showUnderline && "underline decoration-dotted underline-offset-2",
        className
      )}
    >
      {agentName}
    </span>
  );
}
