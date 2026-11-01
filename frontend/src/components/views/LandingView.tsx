"use client";

import React from "react";
import { Project, EditVersion, CreatorPreference } from "@/types";
import { HomeDashboardView } from "./HomeDashboardView";

interface LandingViewProps {
  activeProject: Project | null;
  activePreviewUrl: string;
  versions: EditVersion[];
  preferences: CreatorPreference[];
  isSeeding: boolean;
  onOpenStudio: () => void;
  onSeedDemo: () => void;
  onManagePreferences: () => void;
  projects?: Project[];
  onSelectProject?: (p: Project) => void;
  onCreateNewProject?: (prompt: string, cuts: string[]) => Promise<void>;
  onRefreshProjects?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  projects = [],
  activeProject,
  onSelectProject = () => {},
  onOpenStudio,
  onCreateNewProject = async () => {},
  onRefreshProjects = () => {},
}) => {
  return (
    <HomeDashboardView
      projects={projects}
      activeProject={activeProject}
      onSelectProject={onSelectProject}
      onOpenStudio={onOpenStudio}
      onCreateNewProject={onCreateNewProject}
      onRefreshProjects={onRefreshProjects}
    />
  );
};
