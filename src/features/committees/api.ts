import { requestContentJson, requestV1Json } from '@/lib/api/client';
import type {
  CommitteeDetailDto,
  CommitteeDiscoverableDto,
  CommitteeDocumentDto,
  CommitteeFeedPage,
  CommitteeInvitationInbox,
  CommitteeDecisionDto,
  CommitteePollDto,
  CommitteePostDto,
  CommitteeSummaryDto,
  CommitteeTaskDto,
  CreateDecisionRequest,
  CreateDocumentRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  CreatePollRequest,
  CreatePostRequest,
  CreateTaskRequest,
  RequestJoinRequest,
  RequestJoinResponse,
  RespondInvitationRequest,
  RespondInvitationResponse,
  RevokeInvitationResponse,
  UpdateTaskRequest,
  VotePollRequest,
} from '@shared/contracts/committees-contract';

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function authJson(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getMyCommittees(token: string): Promise<CommitteeSummaryDto[]> {
  return requestV1Json('/committees', { headers: auth(token) });
}

export async function getDiscoverableCommittees(
  token: string,
): Promise<CommitteeDiscoverableDto[]> {
  return requestV1Json('/committees/discoverable', { headers: auth(token) });
}

export async function getCommitteeDetail(
  token: string,
  committeeId: number,
): Promise<CommitteeDetailDto> {
  return requestV1Json(`/committees/${committeeId}`, { headers: auth(token) });
}

export async function getCommitteeFeed(
  token: string,
  committeeId: number,
  cursor?: string | null,
): Promise<CommitteeFeedPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return requestV1Json(`/committees/${committeeId}/feed${qs}`, { headers: auth(token) });
}

export async function createCommitteePost(
  token: string,
  committeeId: number,
  body: CreatePostRequest,
): Promise<CommitteePostDto> {
  return requestV1Json(`/committees/${committeeId}/posts`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function requestJoinCommittee(
  token: string,
  committeeId: number,
  body: RequestJoinRequest = {},
): Promise<RequestJoinResponse> {
  return requestV1Json(`/committees/${committeeId}/request-join`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function getInvitationInbox(token: string): Promise<CommitteeInvitationInbox> {
  return requestV1Json('/committees/invitations', { headers: auth(token) });
}

export async function respondToInvitation(
  token: string,
  invitationId: number,
  body: RespondInvitationRequest,
): Promise<RespondInvitationResponse> {
  return requestV1Json(`/committees/invitations/${invitationId}/respond`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function revokeOrWithdrawInvitation(
  token: string,
  committeeId: number,
  invitationId: number,
): Promise<RevokeInvitationResponse> {
  return requestV1Json(`/committees/${committeeId}/invitations/${invitationId}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

export async function inviteMemberToCommittee(
  token: string,
  committeeId: number,
  body: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  return requestV1Json(`/committees/${committeeId}/invitations`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

// ─── Invite picker ────────────────────────────────────────────────────────────

export interface InvitableMember {
  memberUserId: number;
  memberId: number | null;
  name: string | null;
  city: string | null;
  country: string | null;
  photoUrl: string | null;
}

export async function getInvitableMembers(
  token: string,
  committeeId: number,
  q: string,
): Promise<InvitableMember[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return requestV1Json(`/committees/${committeeId}/invitable-members${qs}`, {
    headers: auth(token),
  });
}

// ─── Polls ────────────────────────────────────────────────────────────────────

export async function createCommitteePoll(
  token: string,
  committeeId: number,
  body: CreatePollRequest,
): Promise<CommitteePollDto> {
  return requestV1Json(`/committees/${committeeId}/polls`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function getCommitteePoll(
  token: string,
  committeeId: number,
  pollId: number,
): Promise<CommitteePollDto> {
  return requestV1Json(`/committees/${committeeId}/polls/${pollId}`, {
    headers: auth(token),
  });
}

export async function voteOnCommitteePoll(
  token: string,
  committeeId: number,
  pollId: number,
  body: VotePollRequest,
): Promise<CommitteePollDto> {
  return requestV1Json(`/committees/${committeeId}/polls/${pollId}/vote`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function closeCommitteePoll(
  token: string,
  committeeId: number,
  pollId: number,
): Promise<CommitteePollDto> {
  return requestV1Json(`/committees/${committeeId}/polls/${pollId}/close`, {
    method: 'POST',
    headers: auth(token),
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getCommitteeTasks(
  token: string,
  committeeId: number,
): Promise<CommitteeTaskDto[]> {
  return requestV1Json(`/committees/${committeeId}/tasks`, { headers: auth(token) });
}

export async function getCommitteeTask(
  token: string,
  committeeId: number,
  taskId: number,
): Promise<CommitteeTaskDto> {
  return requestV1Json(`/committees/${committeeId}/tasks/${taskId}`, {
    headers: auth(token),
  });
}

export async function createCommitteeTask(
  token: string,
  committeeId: number,
  body: CreateTaskRequest,
): Promise<CommitteeTaskDto> {
  return requestV1Json(`/committees/${committeeId}/tasks`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function updateCommitteeTask(
  token: string,
  committeeId: number,
  taskId: number,
  body: UpdateTaskRequest,
): Promise<CommitteeTaskDto> {
  return requestV1Json(`/committees/${committeeId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export async function getCommitteeDecisions(
  token: string,
  committeeId: number,
): Promise<CommitteeDecisionDto[]> {
  return requestV1Json(`/committees/${committeeId}/decisions`, { headers: auth(token) });
}

export async function getCommitteeDecision(
  token: string,
  committeeId: number,
  decisionId: number,
): Promise<CommitteeDecisionDto> {
  return requestV1Json(`/committees/${committeeId}/decisions/${decisionId}`, {
    headers: auth(token),
  });
}

export async function createCommitteeDecision(
  token: string,
  committeeId: number,
  body: CreateDecisionRequest,
): Promise<CommitteeDecisionDto> {
  return requestV1Json(`/committees/${committeeId}/decisions`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getCommitteeDocuments(
  token: string,
  committeeId: number,
): Promise<CommitteeDocumentDto[]> {
  return requestV1Json(`/committees/${committeeId}/documents`, { headers: auth(token) });
}

export async function getCommitteeDocument(
  token: string,
  committeeId: number,
  docId: number,
): Promise<CommitteeDocumentDto> {
  return requestV1Json(`/committees/${committeeId}/documents/${docId}`, {
    headers: auth(token),
  });
}

export async function createCommitteeDocument(
  token: string,
  committeeId: number,
  body: CreateDocumentRequest,
): Promise<CommitteeDocumentDto> {
  return requestV1Json(`/committees/${committeeId}/documents`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function archiveCommitteeDocument(
  token: string,
  committeeId: number,
  docId: number,
): Promise<CommitteeDocumentDto> {
  return requestV1Json(`/committees/${committeeId}/documents/${docId}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

export async function getCommitteeDocumentDownloadUrl(
  token: string,
  committeeId: number,
  docId: number,
): Promise<{ downloadUrl: string; mimeType: string | null }> {
  return requestV1Json(`/committees/${committeeId}/documents/${docId}/download`, {
    headers: auth(token),
  });
}

// ─── Reactions ────────────────────────────────────────────────────────────────
// The reactions/comments endpoints accept entityType="committee_post" and
// authenticate via either NextAuth cookies or the mobile bearer token.

export interface PostReactionState {
  count: number;
  likedByMe: boolean;
  likers: { name: string | null; date: string }[];
}

export async function getPostReactions(
  token: string,
  postId: number,
): Promise<PostReactionState> {
  return requestContentJson(
    `/reactions?entityType=committee_post&entityId=${postId}`,
    { headers: auth(token) },
  );
}

export async function togglePostReaction(
  token: string,
  postId: number,
): Promise<{ liked: boolean; count: number }> {
  return requestContentJson('/reactions', {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ entityType: 'committee_post', entityId: postId }),
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface PostComment {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { name: string | null; memberUserId: number };
}

export async function getPostComments(
  token: string,
  postId: number,
): Promise<{ comments: PostComment[]; total: number }> {
  return requestContentJson(
    `/comments?entityType=committee_post&entityId=${postId}&limit=50`,
    { headers: auth(token) },
  );
}

export async function createPostComment(
  token: string,
  postId: number,
  body: string,
): Promise<PostComment> {
  return requestContentJson('/comments', {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ entityType: 'committee_post', entityId: postId, body }),
  });
}
