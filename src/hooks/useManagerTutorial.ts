import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TUTORIAL_STORAGE_KEY = "welile_manager_tutorial_completed";

export const useManagerTutorial = () => {
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  });

  const startTutorial = () => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      popoverClass: "driver-popover-custom",
      steps: [
        {
          element: "#welcome-message",
          popover: {
            title: "Welcome to Welile Manager Dashboard! 👋",
            description: "Let's take a quick tour of the key features to help you manage your agent network effectively.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#stats-total-agents",
          popover: {
            title: "Agent Overview",
            description: "Track the total number of agents in your network. Click this card to view detailed agent management.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#stats-total-tenants",
          popover: {
            title: "Tenant Portfolio",
            description: "Monitor all tenants across your agent network. This shows the total tenant count managed by all agents.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#stats-pending-verifications",
          popover: {
            title: "Payment Verifications",
            description: "Review and approve/reject payment submissions from agents. Click here to access the verification queue.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#stats-portfolio-value",
          popover: {
            title: "Total Portfolio Value",
            description: "View the combined outstanding balance across all tenants. This represents the total capital deployed in your network.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#activity-feed",
          popover: {
            title: "Live Activity Feed",
            description: "Monitor real-time agent activities including tenant additions, payment recordings, and profile updates.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "#bulk-messaging",
          popover: {
            title: "Bulk Messaging",
            description: "Send announcements and reminders to multiple agents at once using pre-built or custom templates.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#payment-broadcast",
          popover: {
            title: "Payment Broadcast",
            description: "Record tenant payments and notify agents directly. Agents can apply these payments to tenant accounts.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#search-features",
          popover: {
            title: "Quick Search",
            description: "Search for tenants or agents quickly from the dashboard with advanced filtering options.",
            side: "bottom",
            align: "start",
          },
        },
        {
          popover: {
            title: "You're All Set! 🎉",
            description: "You now know the key features of the manager dashboard. Explore the navigation menu for more tools like Agent Management, Verifications, and Reports.",
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
        setHasCompletedTutorial(true);
      },
    });

    driverObj.drive();
  };

  const resetTutorial = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setHasCompletedTutorial(false);
  };

  return {
    hasCompletedTutorial,
    startTutorial,
    resetTutorial,
  };
};
