export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'improvement' | 'fix' | 'security';
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2025-01-28",
    changes: [
      {
        type: "feature",
        description: "Added release notes display when updates are installed"
      },
      {
        type: "feature",
        description: "Added manual 'Check for Updates' button in settings"
      },
      {
        type: "improvement",
        description: "Improved automatic update detection - now checks every 2 minutes"
      },
      {
        type: "improvement",
        description: "Enhanced message read receipts with detailed timestamps"
      }
    ]
  },
  {
    version: "1.1.0",
    date: "2025-01-27",
    changes: [
      {
        type: "feature",
        description: "Manager messages now appear prominently on agent dashboard"
      },
      {
        type: "feature",
        description: "Auto-scroll to new manager messages when they arrive"
      },
      {
        type: "feature",
        description: "Added deletion confirmation requiring managers to type item names"
      },
      {
        type: "security",
        description: "Added deletion reason tracking for audit compliance"
      }
    ]
  },
  {
    version: "1.0.0",
    date: "2025-01-26",
    changes: [
      {
        type: "feature",
        description: "Initial release of Welile Tenants Hub"
      },
      {
        type: "feature",
        description: "Agent and Manager dashboards with real-time sync"
      },
      {
        type: "feature",
        description: "Tenant management and payment tracking"
      },
      {
        type: "feature",
        description: "Offline-first PWA with automatic sync"
      }
    ]
  }
];

export const getLatestVersion = () => changelog[0];

export const getChangelogForVersion = (version: string) => 
  changelog.find(entry => entry.version === version);

export const getChangesSince = (currentVersion: string) => {
  const currentIndex = changelog.findIndex(entry => entry.version === currentVersion);
  if (currentIndex === -1) return changelog;
  return changelog.slice(0, currentIndex);
};
