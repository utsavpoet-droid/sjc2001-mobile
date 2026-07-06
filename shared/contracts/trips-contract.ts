export type TripStatus = 'PLANNING' | 'ACTIVE' | 'RECONCILING' | 'SETTLED' | 'CANCELLED';
export type AttendeeStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'FORFEITED';
export type ExpenseCategory =
  | 'ACCOMMODATION'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ACTIVITIES'
  | 'ALCOHOL'
  | 'SUPPLIES'
  | 'FORFEIT_CREDIT'
  | 'OTHER';
export type ExpenseStatus = 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED' | 'REJECTED';

export interface TripSummary {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  address: string | null;
  timezone: string;
  coverPhotoUrl: string | null;
  status: TripStatus;
  isPublic: boolean;
  stats: { totalSpent: number; expenseCount: number; attendeeCount: number };
}

export interface TripAttendee {
  id: number;
  memberId: number | null;
  legendId: number | null;
  guestName: string | null;
  status: AttendeeStatus;
  shareRatio: string;
  travelMode: string | null;
  arrivalTime: string | null;
  arrivalAirport: string | null;
  arrivalFlight: string | null;
  departureTime: string | null;
  departureAirport: string | null;
  departureFlight: string | null;
  carpoolLeader: boolean;
  notes: string | null;
  member: { id: number; name: string } | null;
  legend: { id: number; name: string } | null;
}

export interface TripExpenseSplit {
  id: number;
  memberId: number | null;
  shareAmount: string;
  member: { id: number; name: string } | null;
  guestName: string | null;
}

export interface TripExpense {
  id: number;
  title: string;
  category: ExpenseCategory;
  date: string;
  totalAmount: string;
  currency: string;
  notes: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
  flagReason: string | null;
  paidByMember: { id: number; name: string } | null;
  splits: TripExpenseSplit[];
  submittedBy: { id: number; name: string } | null;
}

export interface TripBalance {
  memberId: number | null;
  name: string;
  shareOwed: number;
  advancesPaid: number;
  fronted: number;
  directPaid: number;
  directReceived: number;
  totalPaid: number;
  balance: number;
  isSettled: boolean;
  hasPendingConfirmation: boolean;
  paymentHandles?: {
    venmo: string | null;
    zelle: string | null;
    paypal: string | null;
    upi: string | null;
  };
}

export interface TripAlbum {
  id: number;
  title: string;
  coverPhotoUrl: string | null;
  isLocked: boolean;
  _count: { photos: number };
}

export interface TripAlbumPhoto {
  id: number;
  url: string;
  thumbUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: { id: number; name: string } | null;
}

export interface MyTravelRecord {
  id: number;
  travelMode: string | null;
  arrivalTime: string | null;
  arrivalAirport: string | null;
  arrivalFlight: string | null;
  departureTime: string | null;
  departureAirport: string | null;
  departureFlight: string | null;
  carpoolLeader?: boolean;
}

export interface TravelScanResult {
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  arrivalFlight?: string | null;
  departureFlight?: string | null;
  travelMode: string | null;
}

export interface SubmitExpenseBody {
  title: string;
  category: ExpenseCategory;
  date: string;
  totalAmount: number;
  notes?: string | null;
  receiptUrl?: string | null;
  splitType?: 'EQUAL';
  splits: { memberId: number; shareAmount: number }[];
}

export interface ReportPaymentBody {
  amount: number;
  notes?: string;
  date: string;
}

export type TripTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TripTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface TripTaskAssignee {
  id: number;
  memberUser: {
    id: number;
    member: {
      id: number;
      name: string;
      photos: { photoUrl: string }[];
    } | null;
  };
}

export interface TripTask {
  id: number;
  title: string;
  description: string | null;
  status: TripTaskStatus;
  priority: TripTaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdById: number;
  assignees: TripTaskAssignee[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripTaskBody {
  title: string;
  description?: string | null;
  priority?: TripTaskPriority;
  dueDate?: string | null;
  assigneeIds?: number[];
  assigneeMemberIds?: number[];
}

export interface UpdateTripTaskBody {
  title?: string;
  description?: string | null;
  status?: TripTaskStatus;
  priority?: TripTaskPriority;
  dueDate?: string | null;
  assigneeIds?: number[];
  assigneeMemberIds?: number[];
}

export interface UpdateTravelBody {
  travelMode?: string | null;
  arrivalTime?: string | null;
  arrivalAirport?: string | null;
  arrivalFlight?: string | null;
  departureTime?: string | null;
  departureAirport?: string | null;
  departureFlight?: string | null;
  carpoolLeader?: boolean;
}
