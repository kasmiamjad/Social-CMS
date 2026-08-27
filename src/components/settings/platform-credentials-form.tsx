"use client";

import { Camera, PlayCircle, Globe, Briefcase, Hash, Key, MessageCircle, ShieldCheck, Lock } from "lucide-react";
import { OAuthConnectCard, type OAuthPlatformDefinition } from "./oauth-connect-card";
import { ManualCredentialsCard, type ManualPlatformDefinition } from "./manual-credentials-card";
import { WhatsAppQrConnectCard } from "./whatsapp-qr-connect-card";
import type { OAuthConnection } from "@/services/oauth/types";

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

/**
 * Platforms that use the full OAuth redirect flow and are currently active.
 */
const ACTIVE_OAUTH_PLATFORMS: OAuthPlatformDefinition[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: PlayCircle,
    description: "Automate comment replies using transcript-aware AI",
    devConsoleUrl: "https://console.cloud.google.com/apis/credentials",
    setupGuide: [
      {
        title: "Create Google Cloud project",
        detail: "Go to console.cloud.google.com, create a project, and enable YouTube Data API v3.",
      },
      {
        title: "Create OAuth 2.0 credentials",
        detail:
          "Under APIs & Services → Credentials, create an OAuth 2.0 Client ID (Web application type).",
      },
      {
        title: "Add redirect URI",
        detail:
          "Copy the Authorized Redirect URI shown in the form below and add it to your OAuth client's Authorized redirect URIs.",
      },
      {
        title: "Copy credentials",
        detail: "Paste your Client ID and Client Secret into the fields above and save.",
      },
    ],
  },
];

/**
 * Platforms with OAuth providers registered but not yet fully implemented.
 * Rendered as disabled "Coming Soon" cards.
 */
const COMING_SOON_PLATFORMS: OAuthPlatformDefinition[] = [
  {
    id: "facebook",
    name: "Facebook",
    icon: Globe,
    description: "Post to pages and automate engagement",
    devConsoleUrl: "https://developers.facebook.com/apps",
    comingSoon: true,
    setupGuide: [],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Briefcase,
    description: "Post to profiles and company pages",
    devConsoleUrl: "https://www.linkedin.com/developers/apps",
    comingSoon: true,
    setupGuide: [],
  },
];

/**
 * Platforms that use manual long-lived token entry.
 * Instagram stays here until a full OAuth migration is completed.
 */
const MANUAL_PLATFORMS: ManualPlatformDefinition[] = [
  {
    id: "instagram",
    name: "Instagram",
    icon: Camera,
    description: "Post + AI auto-reply to DMs and comments",
    fields: [
      {
        key: "account_id",
        label: "Instagram Account ID",
        placeholder: "e.g. 17841456545908024",
        type: "text",
        icon: Hash,
        helpText: "Your numeric Instagram Business/Creator Account ID",
      },
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "Your long-lived Facebook access token",
        type: "password",
        icon: Key,
        helpText:
          "Requires: instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages, pages_show_list, pages_read_engagement",
      },
      {
        key: "app_id",
        label: "App ID (for engagement webhooks)",
        placeholder: "e.g. 1884050208953529",
        type: "text",
        icon: Hash,
        helpText: "Your Meta app ID. Required only if using DM / comment automation.",
        required: false,
      },
      {
        key: "app_secret",
        label: "App Secret (for engagement webhooks)",
        placeholder: "32-character hex string",
        type: "password",
        icon: Lock,
        helpText: "App Settings → Basic → App Secret. Used to verify webhook signatures.",
        required: false,
      },
      {
        key: "verify_token",
        label: "Webhook Verify Token",
        placeholder: "Any random string you choose",
        type: "text",
        icon: ShieldCheck,
        helpText:
          "Make up a random string (e.g. 'social_cms_ig_2024'). Paste the SAME string in Meta when subscribing the Instagram webhook.",
        required: false,
      },
    ],
    setupGuide: [
      {
        title: "Create Meta app",
        detail:
          "Go to developers.facebook.com, create a Business app, and add the Instagram product.",
      },
      {
        title: "Grant permissions",
        detail:
          "For POSTING: instagram_basic, instagram_content_publish. For ENGAGEMENT (DMs/comments): instagram_manage_comments, instagram_manage_messages.",
      },
      {
        title: "Get long-lived token",
        detail: "Exchange the short-lived token using Facebook OAuth token exchange endpoint, or generate a System User token.",
      },
      {
        title: "Fetch Account ID",
        detail:
          "Call /me/accounts and then /{page-id}?fields=instagram_business_account to get the numeric account ID.",
      },
      {
        title: "Subscribe webhook (for DMs/comments)",
        detail:
          "App Dashboard → Instagram → Webhooks → Callback URL: https://crm.a3sixty.com/api/v1/instagram/webhook → Verify Token: paste the same string above → Subscribe to 'messages' and 'comments' fields.",
      },
      {
        title: "Save credentials",
        detail: "Paste all fields above and save.",
      },
    ],
  },
  {
    id: "messenger",
    name: "Facebook Messenger",
    icon: MessageCircle,
    description: "AI auto-reply to your Facebook Page messages",
    fields: [
      {
        key: "page_id",
        label: "Facebook Page ID",
        placeholder: "e.g. 123456789012345",
        type: "text",
        icon: Hash,
        helpText: "The numeric ID of the Page the bot replies as (Page → About, or Meta dashboard).",
      },
      {
        key: "page_access_token",
        label: "Page Access Token",
        placeholder: "EAAxxxxx...",
        type: "password",
        icon: Key,
        helpText: "Messenger → Settings → generate a token for your linked Page (pages_messaging permission).",
      },
      {
        key: "app_secret",
        label: "App Secret",
        placeholder: "32-character hex string",
        type: "password",
        icon: Lock,
        helpText: "App Settings → Basic → App Secret. Used to verify webhook signatures.",
      },
      {
        key: "verify_token",
        label: "Webhook Verify Token",
        placeholder: "Any random string you choose",
        type: "text",
        icon: ShieldCheck,
        helpText: "Make up any string (e.g. 'a3sixty_msgr_2026'). Paste the SAME string into Meta when subscribing the webhook.",
      },
      {
        key: "app_id",
        label: "App ID",
        placeholder: "e.g. 123456789012345",
        type: "text",
        icon: Hash,
        helpText: "Your Meta app ID (optional, informational).",
        required: false,
      },
    ],
    setupGuide: [
      {
        title: "Add Messenger to your Meta app",
        detail: "developers.facebook.com → your app → Add Product → Messenger.",
      },
      {
        title: "Link your Page + generate a token",
        detail: "Messenger → Settings → connect your Facebook Page and generate a Page access token.",
      },
      {
        title: "Subscribe the webhook",
        detail: "Messenger → Settings → Webhooks → Callback URL: https://crm.a3sixty.com/api/v1/messenger/webhook → Verify Token: paste the same string above → subscribe to the 'messages' field, then subscribe your Page.",
      },
      {
        title: "Save & test",
        detail: "Save credentials here, then message your Page from another account. Check the Messenger tab to see it appear.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlatformCredential {
  platform: string;
  credentials: Record<string, string>;
  /** Names of password-type fields that have a saved value (but were stripped before being sent to the client). */
  savedSecretKeys?: string[];
  is_active: boolean;
}

export interface PlatformOAuthConnectionSummary {
  platform: string;
  accountTitle: string;
  status: "active" | "expired" | "disconnected";
  tokenExpiry: string | null;
  oauthProvider: "system" | "custom";
  clientIdUsed: string;
}

interface PlatformCredentialsFormProps {
  /** Masked credential rows for manual platforms. */
  initialCredentials: PlatformCredential[];
  /** OAuth connection summaries fetched server-side. */
  oauthConnections: PlatformOAuthConnectionSummary[];
  /** Custom OAuth app credentials. Secret is never sent to client — only a presence flag. */
  customOAuthApps: Record<string, { client_id?: string; has_client_secret: boolean }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the connected platforms grid on the Settings page.
 *
 * OAuth-based platforms (YouTube, Facebook, LinkedIn) render OAuthConnectCard.
 * Manual-token platforms (Instagram) render ManualCredentialsCard.
 *
 * Adding a new platform:
 * - OAuth: add an entry to OAUTH_PLATFORMS above.
 * - Manual: add an entry to MANUAL_PLATFORMS above.
 */
export function PlatformCredentialsForm({
  initialCredentials,
  oauthConnections,
  customOAuthApps,
}: PlatformCredentialsFormProps) {
  /** Converts a connection summary row into the OAuthConnection shape for the card. */
  function toOAuthConnection(
    connectionRow: PlatformOAuthConnectionSummary | undefined
  ): OAuthConnection | null {
    if (!connectionRow) return null;
    return {
      id: "",
      userId: "",
      platform: connectionRow.platform,
      accountId: "",
      accountTitle: connectionRow.accountTitle,
      tokenExpiry: connectionRow.tokenExpiry ? new Date(connectionRow.tokenExpiry) : null,
      oauthProvider: connectionRow.oauthProvider,
      clientIdUsed: connectionRow.clientIdUsed,
      status: connectionRow.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Active OAuth platforms (YouTube first) */}
      {ACTIVE_OAUTH_PLATFORMS.map((platform) => (
        <OAuthConnectCard
          key={platform.id}
          platform={platform}
          connection={toOAuthConnection(oauthConnections.find((c) => c.platform === platform.id))}
          customCredentials={customOAuthApps[`${platform.id}_oauth_app`] ?? { has_client_secret: false }}
        />
      ))}

      {/* WhatsApp — QR-link (Baileys), not a manual-token platform */}
      <WhatsAppQrConnectCard />

      {/* Manual-token platforms (Instagram) */}
      {MANUAL_PLATFORMS.map((platform) => {
        const existing = initialCredentials.find((c) => c.platform === platform.id);
        return (
          <ManualCredentialsCard
            key={platform.id}
            platform={platform}
            initialCredentials={existing?.credentials ?? {}}
            savedSecretKeys={existing?.savedSecretKeys ?? []}
            isConnected={existing?.is_active === true}
          />
        );
      })}

      {/* Coming-soon platforms — disabled placeholder cards */}
      {COMING_SOON_PLATFORMS.map((platform) => (
        <OAuthConnectCard
          key={platform.id}
          platform={platform}
          connection={null}
          customCredentials={{}}
        />
      ))}
    </div>
  );
}
