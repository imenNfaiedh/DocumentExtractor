export interface NavbarItem {
  routeLink: string;
  icon?: string;
  label: string;
  title: boolean;
}

export interface ScreenConfig {
  width: number;
  class: string;
}

export interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}
