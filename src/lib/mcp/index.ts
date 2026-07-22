import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listChapters from "./tools/list-chapters";
import getChapter from "./tools/get-chapter";
import listBookmarks from "./tools/list-bookmarks";
import bookmarkChapter from "./tools/bookmark-chapter";
import postComment from "./tools/post-comment";
import whoami from "./tools/whoami";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "boy-who-saw-the-truth-mcp",
  title: "The Boy Who Saw The Truth",
  version: "0.1.0",
  instructions:
    "Tools for reading 'The Boy Who Saw The Truth', a mystical serialized novel. Use list_chapters to browse, get_chapter to read a chapter, bookmark_chapter and list_my_bookmarks for the reader's shelf, and post_comment to leave a comment as the signed-in reader.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listChapters, getChapter, listBookmarks, bookmarkChapter, postComment, whoami],
});