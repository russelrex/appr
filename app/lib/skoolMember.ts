export interface SkoolMember {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  tier: string;
  activeAgo: string;
  joinedDate: string;
  location: string;
  price: string;
  renewsIn: string;
  status: "active" | "cancelling" | "cancelled";
  cancelledInfo?: string;
  referralSource: string;
  referralIcon: string;
  level: number;
}
