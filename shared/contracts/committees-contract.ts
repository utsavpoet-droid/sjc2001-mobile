/**
 * SJC Committees — mobile/web shared contract.
 *
 * Mirrors the response shapes of /api/v1/committees/* endpoints. Keep this
 * file in sync as new endpoints are added; importing it on both sides
 * (sjc2001-website and sjc2001-mobile) keeps the JSON shapes from drifting.
 */

export type CommitteeRole = 'CHAIR' | 'MEMBER';
export type MemberAdminRole = 'MEMBER' | 'EDITOR' | 'SUPER_ADMIN';

export type CommitteePostType =
  | 'MESSAGE'
  | 'ANNOUNCEMENT'
  | 'DECISION'
  | 'POLL_REF'
  | 'TASK_REF'
  | 'MEETING_REF'
  | 'SYSTEM';

export type CommitteeTaskStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'CANCELLED';

export type CommitteeTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type CommitteeDecisionStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVERSED';

export type CommitteeRsvpResponse = 'YES' | 'NO' | 'MAYBE';

export type CommitteeInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REVOKED';

export interface CreateInvitationRequest {
  memberUserId: number;
  message?: string;
}

export interface RequestJoinRequest {
  message?: string;
}

export type ExternalDocKind =
  | 'GOOGLE_DRIVE'
  | 'DROPBOX'
  | 'FIGMA'
  | 'CANVA'
  | 'OTHER_LINK';

export type CommitteeDocumentCategory =
  | 'AGENDA'
  | 'MINUTES'
  | 'BUDGET'
  | 'CONTRACT'
  | 'DESIGN'
  | 'PHOTO'
  | 'RECEIPT'
  | 'CHECKLIST'
  | 'OTHER';

// ----- Core entity DTOs (response shapes) -----

export interface MemberRefDto {
  id: number;
  name: string | null;
  photoUrl: string | null;
}

export interface MemberUserRefDto {
  id: number;
  member: MemberRefDto | null;
}

export interface CommitteeSummaryDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  colorHex: string;
  iconName: string | null;
  coverImageUrl: string | null;
  eventContext: string | null;
  /** TripEvent.id this committee plans for (Phase 2). */
  eventId: number | null;
  /** Parent committee for cross-committee budget rollup (one level deep). */
  parentCommitteeId: number | null;
  memberCount: number;
  postCount: number;
  myRole: CommitteeRole;
  joinedAt: string;
}

export interface CommitteeDiscoverableDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  colorHex: string;
  iconName: string | null;
  coverImageUrl: string | null;
  eventContext: string | null;
  memberCount: number;
  /**
   * Set when the caller already has a pending workflow against this committee
   * (either an unaccepted chair invitation OR a join request awaiting approval),
   * so the UI can render "Awaiting approval" / "Invitation pending" affordances
   * instead of a "Request to join" button.
   */
  pendingWorkflow: {
    status: 'PENDING';
    kind: CommitteeInvitationKind;
    requestedBySelf: boolean;
  } | null;
  chairs: Array<{
    memberUserId: number;
    memberId: number | null;
    name: string | null;
    photoUrl: string | null;
  }>;
}

export type CommitteeInvitationKind = 'INVITATION' | 'JOIN_REQUEST';

export interface CommitteeRefDto {
  id: number;
  slug: string;
  name: string;
  colorHex: string;
  archivedAt: string | null;
}

export interface InviterRefDto {
  id: number;
  name: string | null;
  photoUrl: string | null;
}

export interface CommitteeInvitationDto {
  id: number;
  committeeId: number;
  invitedMemberUserId: number;
  invitedById: number;
  status: CommitteeInvitationStatus;
  message: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  kind: CommitteeInvitationKind;
  committee: CommitteeRefDto | null;
  invitedByUser: InviterRefDto | null;
  requestedBySelf: boolean;
}

export interface CommitteeInvitationInbox {
  invitations: CommitteeInvitationDto[];      // chair-issued, addressed to the caller
  myJoinRequests: CommitteeInvitationDto[];   // self-authored, awaiting chair approval
  pendingApprovals: CommitteeInvitationDto[]; // join requests on committees the caller can approve
}

export interface RequestJoinResponse {
  invitation: CommitteeInvitationDto;
  alreadyPending: boolean;
}

export interface CreateInvitationResponse {
  invitation: CommitteeInvitationDto;
  alreadyPending: boolean;
}

export interface RespondInvitationRequest {
  decision: 'ACCEPT' | 'DECLINE' | 'ACCEPTED' | 'DECLINED' | 'APPROVE' | 'REJECT' | 'APPROVED' | 'REJECTED';
}

export interface RespondInvitationResponse {
  invitation: CommitteeInvitationDto;
  membership: CommitteeMemberDto | null;
}

export interface RevokeInvitationResponse {
  invitation: CommitteeInvitationDto;
  /** True when the caller withdrew their own join request; false when a chair/editor revoked it. */
  withdrawnBySelf: boolean;
}

export interface CommitteeMemberDto {
  id: number;
  committeeId: number;
  memberUserId: number;
  role: CommitteeRole;
  addedAt: string;
  leftAt: string | null;
  memberUser: {
    id: number;
    member: MemberRefDto | null;
  };
}

export interface CommitteeDetailDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  colorHex: string;
  iconName: string | null;
  coverImageUrl: string | null;
  eventContext: string | null;
  /** TripEvent.id this committee plans for (Phase 2). */
  eventId: number | null;
  /** Parent committee for cross-committee budget rollup. */
  parentCommitteeId: number | null;
  archivedAt: string | null;
  members: CommitteeMemberDto[];
  caller: {
    isSuperAdmin: boolean;
    isEditor: boolean;
    isChair: boolean;
    isMember: boolean;
  };
  _count: {
    posts: number;
    tasks: number;
    polls: number;
    decisions: number;
    meetings: number;
    documents: number;
  };
}

export interface CommitteePostDto {
  id: number;
  committeeId: number;
  authorId: number;
  author: MemberUserRefDto;
  type: CommitteePostType;
  body: string;
  mediaUrls: string[] | null;
  parentPostId: number | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  poll?: CommitteePollDto | null;
  task?: CommitteeTaskDto | null;
  meeting?: CommitteeMeetingDto | null;
  decision?: CommitteeDecisionDto | null;
  _count?: { replies: number };
}

export interface CommitteePollOptionDto {
  id: number;
  pollId: number;
  text: string;
  position: number;
  voteCount: number;
}

export interface CommitteePollDto {
  id: number;
  committeeId: number;
  postId: number | null;
  authorId: number;
  question: string;
  isMultiSelect: boolean;
  isAnonymous: boolean;
  closesAt: string | null;
  closedAt: string | null;
  options: CommitteePollOptionDto[];
  /** Option IDs the caller has currently voted for; empty array if none. */
  myVoteOptionIds: number[];
}

export interface CreatePollRequest {
  question: string;
  options: string[];
  isMultiSelect?: boolean;
  isAnonymous?: boolean;
  closesAt?: string;
}

export interface VotePollRequest {
  optionIds: number[];
}

export interface CommitteeTaskAssigneeDto {
  id: number;
  taskId: number;
  memberUserId: number;
  assignedAt: string;
  memberUser: {
    id: number;
    member: MemberRefDto | null;
  };
}

export interface CommitteeTaskDto {
  id: number;
  committeeId: number;
  postId: number | null;
  title: string;
  description: string | null;
  status: CommitteeTaskStatus;
  priority: CommitteeTaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  dependsOnTaskId: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  assignees: CommitteeTaskAssigneeDto[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: CommitteeTaskPriority;
  dueDate?: string;
  assigneeIds?: number[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: CommitteeTaskStatus;
  priority?: CommitteeTaskPriority;
  dueDate?: string | null;
  assigneeIds?: number[];
}

export interface CommitteeMeetingDto {
  id: number;
  committeeId: number;
  title: string;
  startsAt: string;
  endsAt: string | null;
  locationText: string | null;
  videoUrl: string | null;
}

export interface CommitteeDecisionDto {
  id: number;
  committeeId: number;
  postId: number | null;
  title: string;
  summary: string;
  decidedOn: string;
  status: CommitteeDecisionStatus;
  recordedById: number;
  pollId: number | null;
  supersededById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDecisionRequest {
  title: string;
  summary: string;
  decidedOn?: string;
  status?: CommitteeDecisionStatus;
  pollId?: number;
  supersededById?: number;
}

export interface CommitteeDocumentDto {
  id: number;
  committeeId: number;
  title: string;
  description: string | null;
  category: CommitteeDocumentCategory;
  version: number;
  parentDocId: number | null;
  s3Key: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  thumbUrl: string | null;
  externalUrl: string | null;
  externalKind: ExternalDocKind | null;
  uploadedById: number;
  uploadedBy: MemberUserRefDto | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  description?: string;
  category?: CommitteeDocumentCategory;
  s3Key?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbUrl?: string;
  externalUrl?: string;
  externalKind?: ExternalDocKind;
}

// ----- Request bodies -----

export interface CreatePostRequest {
  type?: 'MESSAGE' | 'ANNOUNCEMENT';
  body: string;
  parentPostId?: number;
  mediaUrls?: string[];
}

// ----- Paginated responses -----

export interface CommitteeFeedPage {
  posts: CommitteePostDto[];
  nextCursor: string | null; // ISO timestamp; pass back as ?cursor=
  hasMore: boolean;
}

// ----- Committee planning: templates, option lists, options, votes, budget -----

export type CommitteeOptionSelectionMode = 'CHAIR_DECIDES' | 'MEMBER_VOTE';

export type CommitteeOptionStatus =
  | 'PROPOSED'
  | 'SHORTLISTED'
  | 'SELECTED'
  | 'REJECTED';

export type CommitteeOptionSampleStatus =
  | 'NONE'
  | 'REQUESTED'
  | 'RECEIVED'
  | 'APPROVED'
  | 'REJECTED';

export type CommitteeOptionFieldKind =
  | 'text'
  | 'longtext'
  | 'number'
  | 'money'
  | 'boolean'
  | 'select'
  | 'url'
  | 'date';

export interface CommitteeOptionFieldDef {
  key: string;
  kind: CommitteeOptionFieldKind;
  label: string;
  required?: boolean;
  max?: number;
  min?: number;
  unit?: string;
  options?: string[];
}

export interface CommitteeOptionFieldsSchema {
  fields: CommitteeOptionFieldDef[];
}

export interface CommitteeOptionBudgetRule {
  formula: string;
  context?: string[];
}

export interface CommitteeTemplateDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  colorHex: string;
  version: number;
  isBuiltIn: boolean;
  isActive: boolean;
  optionListTemplates: CommitteeOptionListTemplateDto[];
  taskTemplates: CommitteeTaskTemplateDto[];
}

export interface CommitteeOptionListTemplateDto {
  id: number;
  templateId: number;
  key: string;
  name: string;
  description: string | null;
  selectionLimit: number | null;
  selectionMode: CommitteeOptionSelectionMode;
  selectionThresholdPercent: number | null;
  fieldsSchema: CommitteeOptionFieldsSchema;
  budgetRule: CommitteeOptionBudgetRule | null;
  allowMemberPropose: boolean;
  allowImages: boolean;
  sortOrder: number;
}

export interface CommitteeTaskTemplateDto {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  priority: CommitteeTaskPriority;
  dueOffsetDays: number | null;
  sortOrder: number;
}

export interface ApplyTemplateResultDto {
  templateId: number;
  templateSlug: string;
  committee: { id: number; templateId: number | null; templateAppliedAt: string | null };
  createdListKeys: string[];
  createdTaskTitles: string[];
  skippedListKeys: string[];
  warnings?: string[];
}

export interface CommitteeOptionImageDto {
  key: string;
  url: string | null;
}

export interface CommitteeOptionDto {
  id: number;
  optionListId: number;
  title: string;
  description: string | null;
  imageKeys: string[];
  images?: CommitteeOptionImageDto[];
  fields: Record<string, unknown>;
  selectionStatus: CommitteeOptionStatus;
  sampleStatus: CommitteeOptionSampleStatus;
  proposedById: number;
  proposedBy?: MemberUserRefDto;
  selectedById: number | null;
  selectedAt: string | null;
  selectedOverBudget: boolean;
  voteCount: number;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommitteeOptionListDto {
  id: number;
  committeeId: number;
  sourceTemplateId: number | null;
  key: string;
  name: string;
  description: string | null;
  selectionLimit: number | null;
  selectionMode: CommitteeOptionSelectionMode;
  selectionThresholdPercent: number | null;
  fieldsSchema: CommitteeOptionFieldsSchema;
  budgetRule: CommitteeOptionBudgetRule | null;
  allowMemberPropose: boolean;
  allowImages: boolean;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  options: CommitteeOptionDto[];
}

export interface CommitteeBudgetDto {
  id: number;
  committeeId: number;
  totalBudget: string;
  currency: string;
  notes: string | null;
  setById: number;
  createdAt: string;
  updatedAt: string;
}

export type CommitteeBudgetWarningKind =
  | 'OVER_BUDGET'
  | 'UNEVALUABLE'
  | 'CHILD_CURRENCY_MISMATCH'
  | 'CHILD_OVER_BUDGET';

export interface CommitteeBudgetWarningDto {
  /** Set for OVER_BUDGET / UNEVALUABLE option-level warnings. */
  optionId?: number;
  listId?: number;
  /** Set for CHILD_* warnings. */
  childCommitteeId?: number;
  kind: CommitteeBudgetWarningKind;
  reason: string;
}

export interface CommitteeBudgetEventContextDto {
  /** Resolved at snapshot time from the linked TripEvent. */
  eventId?: number;
  eventTitle?: string;
  /** Confirmed attendees of the linked event — formulas reference this as `attendeeCount`. */
  attendeeCount?: number;
}

export interface CommitteeBudgetRollupChildDto {
  committeeId: number;
  name: string;
  slug: string;
  currency: string;
  hasBudget: boolean;
  totalBudget: number;
  committedSpend: number;
  tentativeSpend: number;
  isOverBudget: boolean;
  /** False when child currency differs from parent — child is excluded from totals. */
  currencyMatchesParent: boolean;
}

export interface CommitteeBudgetRollupDto {
  totalCommittedIncludingChildren: number;
  totalTentativeIncludingChildren: number;
  children: CommitteeBudgetRollupChildDto[];
}

export interface CommitteeBudgetSnapshotDto {
  hasBudget: boolean;
  totalBudget: number;
  currency: string;
  committedSpend: number;
  tentativeSpend: number;
  remaining: number;
  delta: number;
  isOverBudget: boolean;
  byList: Array<{
    listId: number;
    listKey: string;
    listName: string;
    committed: number;
    tentative: number;
  }>;
  warnings: CommitteeBudgetWarningDto[];
  /** Resolved live event context — present when committee is linked to a TripEvent. */
  context?: CommitteeBudgetEventContextDto;
  /** Present only when this committee has child committees. One level deep. */
  rollup?: CommitteeBudgetRollupDto;
}

export interface CommitteeBudgetResponseDto {
  budget: CommitteeBudgetDto | null;
  snapshot: CommitteeBudgetSnapshotDto;
  commonCurrencies: readonly string[];
}

export interface CreateCommitteeOptionRequest {
  title: string;
  description?: string | null;
  fields: Record<string, unknown>;
  imageKeys?: string[];
}

export interface UpdateCommitteeOptionStatusRequest {
  status: CommitteeOptionStatus;
  acknowledgeOverBudget?: boolean;
}

export interface UpdateCommitteeOptionSampleRequest {
  sampleStatus: CommitteeOptionSampleStatus;
  /** Free-text reason captured into the sample timeline (Phase 2). */
  note?: string | null;
}

export interface CommitteeOptionSampleEventDto {
  id: number;
  fromStatus: CommitteeOptionSampleStatus;
  toStatus: CommitteeOptionSampleStatus;
  note: string | null;
  changedById: number;
  changedBy: MemberUserRefDto | null;
  createdAt: string;
}

export interface CommitteeOptionSampleTimelineResponse {
  events: CommitteeOptionSampleEventDto[];
}

export interface VoteCommitteeOptionResponse {
  voted: boolean;
  voteCount: number;
  autoPromoted: 'SELECTED' | 'SHORTLISTED' | null;
  autoPromoteBlocked: string | null;
}

export interface PresignOptionImageRequest {
  contentType: string;
  filename?: string;
}

export interface PresignOptionImageResponse {
  key: string;
  uploadUrl: string;
}

export interface SetCommitteeBudgetRequest {
  totalBudget: number;
  currency?: string;
  notes?: string | null;
}

export interface ApplyCommitteeTemplateRequest {
  templateId?: number;
  templateSlug?: string;
}

// ----- Custom template authoring (Phase 2, editor-only) -----

export interface OptionListTemplateAuthorInput {
  key: string;
  name: string;
  description?: string | null;
  selectionLimit?: number | null;
  selectionMode?: CommitteeOptionSelectionMode;
  selectionThresholdPercent?: number | null;
  fieldsSchema: CommitteeOptionFieldsSchema;
  budgetRule?: CommitteeOptionBudgetRule | null;
  allowMemberPropose?: boolean;
  allowImages?: boolean;
  sortOrder?: number;
}

export interface TaskTemplateAuthorInput {
  title: string;
  description?: string | null;
  priority?: CommitteeTaskPriority;
  dueOffsetDays?: number | null;
  sortOrder?: number;
}

export interface CreateCommitteeTemplateRequest {
  slug: string;
  name: string;
  description?: string | null;
  iconName?: string | null;
  colorHex?: string;
  isActive?: boolean;
  /** Clone lists/tasks from this slug; ignored if optionLists/tasks are also provided. */
  fromTemplateSlug?: string;
  optionLists?: OptionListTemplateAuthorInput[];
  tasks?: TaskTemplateAuthorInput[];
}

export interface UpdateCommitteeTemplateRequest {
  name?: string;
  description?: string | null;
  iconName?: string | null;
  colorHex?: string;
  isActive?: boolean;
  /** Full replacement when provided. */
  optionLists?: OptionListTemplateAuthorInput[];
  /** Full replacement when provided. */
  tasks?: TaskTemplateAuthorInput[];
}

// ----- Envelope (matches /api/v1/* convention from lib/mobileApi.ts) -----

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code:
      | 'AUTH_REQUIRED'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'MFA_REQUIRED'
      | 'MFA_PENDING'
      | 'VALIDATION_ERROR'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'OVER_BUDGET'
      | 'SELECTION_LIMIT'
      | 'CURRENCY_LOCKED'
      | 'INVALID_KEY'
      | 'TOO_MANY_IMAGES'
      | 'UNSUPPORTED_TYPE'
      | 'TEMPLATE_BUILTIN'
      | 'TEMPLATE_INVALID'
      | 'PARENT_NOT_TOPLEVEL'
      | 'EVENT_NOT_FOUND'
      | 'SERVER_ERROR'
      | string;
    message: string;
  };
}

export type CommitteeApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
