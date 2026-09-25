Updated master prompt with the real WhatsApp → AI → broker catalog workflow included.

PropFlow — PropTech SaaS

Next.js + WhatsApp + AI Property Catalog

Build a production-quality multi-tenant PropTech SaaS for Indian real-estate brokers.

The core product workflow is:

Broker WhatsApp
      ↓
WhatsApp Business Cloud API
      ↓
Webhook
      ↓
Message Queue
      ↓
Text + Images + Media
      ↓
AI Property Extraction & Enrichment
      ↓
Property Draft
      ↓
Broker Review
      ↓
Publish
      ↓
Broker Property Catalog
      ↓
Customer Property Page
      ↓
WhatsApp Enquiry

The application must be designed as a real SaaS product, not a static demo.

⸻

1. Product Concept

Problem

Indian real-estate brokers commonly send customers:

* Property descriptions
* Images
* Videos
* Prices
* Locations
* Area
* BHK/configuration
* Amenities

through WhatsApp.

The information is unstructured and difficult to manage.

Solution

PropFlow converts WhatsApp property messages into professional property listings.

Example:

Broker sends:

3BHK flat in Whitefield
1800 sqft
₹1.5 Cr
Semi furnished
2 parking
[images]

PropFlow automatically:

WhatsApp
    ↓
AI
    ↓
Structured Property
    ↓
Professional Listing

The broker reviews the listing and publishes it.

⸻

2. Core Product Promise

Turn your WhatsApp property messages into a professional property catalog.

Secondary positioning:

Your WhatsApp property inventory, organized and powered by AI.

⸻

3. Tech Stack

Use:

* Next.js latest stable
* TypeScript
* App Router
* Tailwind CSS
* shadcn/ui
* Lucide React
* React Hook Form
* Zod
* MongoDB
* Mongoose
* Redis
* BullMQ
* OpenAI API
* Meta WhatsApp Business Cloud API
* S3-compatible object storage
* Auth.js / equivalent authentication
* Razorpay-ready billing abstraction

Use strict TypeScript.

⸻

4. Application Architecture

Use a modular architecture.

Frontend
    ↓
Next.js
    ↓
API / Server Actions
    ↓
Services
    ↓
MongoDB / Redis / External APIs

Backend modules:

auth
users
tenants
brokers
properties
collections
media
whatsapp
ai
leads
analytics
subscriptions
domains
notifications
admin

Every tenant-owned database record must contain:

tenantId

Tenant isolation is mandatory.

⸻

5. Main Routes

Create:

/
 /login
 /register
 /dashboard
 /dashboard/properties
 /dashboard/properties/new
 /dashboard/properties/[id]
 /dashboard/properties/[id]/review
 /dashboard/collections
 /dashboard/collections/[id]
 /dashboard/whatsapp
 /dashboard/leads
 /dashboard/analytics
 /dashboard/settings
 /dashboard/settings/profile
 /dashboard/settings/whatsapp
 /dashboard/settings/branding
 /dashboard/settings/domain
 /dashboard/settings/billing
 /[brokerSlug]
 /[brokerSlug]/property/[propertySlug]
 /[brokerSlug]/collections/[collectionSlug]

⸻

6. Landing Page

Build a premium PropTech SaaS landing page.

Hero

Headline:

Turn WhatsApp Property Messages Into Professional Listings.

Subheading:

Send property details and images on WhatsApp. PropFlow uses AI to organize them into beautiful, shareable property listings for your real-estate business.

Primary CTA:

Start Free

Secondary CTA:

See How It Works

Show a realistic product visualization.

WhatsApp
   ↓
AI
   ↓
Property Listing
   ↓
Customer
   ↓
WhatsApp Lead

⸻

7. Landing Page — Problem Section

Headline:

Your property inventory shouldn’t live inside WhatsApp chats.

Three cards:

Messy Property Sharing

Property information is scattered across WhatsApp conversations.

Repetitive Work

Brokers repeatedly send the same images and property details.

Lost Context

Customers receive property information without a professional property page or clear enquiry flow.

⸻

8. Landing Page — WhatsApp Workflow

This is the main product demonstration.

Show a WhatsApp-style conversation.

Broker
New Property
3 BHK Apartment
Whitefield
1800 sqft
₹1.5 Cr
Semi Furnished
2 Parking
[Image]
[Image]
[Image]

Then animate into:

PropFlow
✓ Message received
✓ Images processed
✓ Property detected
✓ Location identified
✓ Price identified
✓ Property details structured

Then:

PROPERTY DRAFT READY
Premium 3 BHK Apartment
Whitefield, Bangalore
₹1.50 Cr
1,800 sq.ft.
3 BHK
2 Parking
[Review Property]

Do not claim that AI automatically publishes the property.

The correct workflow is:

WhatsApp
   ↓
AI
   ↓
Draft
   ↓
Broker Review
   ↓
Publish

⸻

9. Authentication

Login

Create:

Email
Password
[Sign In]
[Continue with Google]
Forgot password?
Don't have an account?
Create account

Include:

* Validation
* Loading state
* Error state
* Success state
* Password visibility toggle

Registration

Fields:

Full Name
Business Name
Email
WhatsApp Number
Password
Confirm Password
City

Registration flow:

Register
   ↓
Create User
   ↓
Create Tenant
   ↓
Create Broker Profile
   ↓
Generate Broker Slug
   ↓
Dashboard

Example:

rehanbrokers.propflow.in

⸻

10. WhatsApp Business Integration

Use the Meta WhatsApp Business Cloud API.

Do not build a fake production WhatsApp integration.

Create an abstraction layer so the provider can be changed later.

Services:

WhatsAppService
WhatsAppWebhookService
WhatsAppMessageService
WhatsAppMediaService
WhatsAppTemplateService

⸻

11. WhatsApp Webhook

Create:

POST /api/webhooks/whatsapp
GET  /api/webhooks/whatsapp

GET handles webhook verification.

POST handles incoming events.

The webhook should:

1. Validate the request.
2. Identify the broker/tenant.
3. Store the incoming message.
4. Store WhatsApp message ID.
5. Identify message type.
6. Queue processing.
7. Return quickly.

Do not perform heavy AI processing directly inside the webhook request.

⸻

12. Message Processing Architecture

Use Redis + BullMQ.

WhatsApp Cloud API
        ↓
Webhook
        ↓
Save Message
        ↓
BullMQ Job
        ↓
Property Processing Worker

Worker:

PropertyProcessingWorker

Process:

Incoming Message
       ↓
Extract Text
       ↓
Download Media
       ↓
Store Images
       ↓
AI Extraction
       ↓
AI Enrichment
       ↓
Validation
       ↓
Create Property Draft
       ↓
Notify Broker

⸻

13. WhatsApp Message Types

Support:

text
image
multiple images
video
document
location

MVP priority:

text
image
multiple images

Store:

messageId
from
timestamp
type
text
mediaId
mediaUrl
tenantId
processingStatus

⸻

14. Media Processing

When WhatsApp sends an image:

WhatsApp Media ID
      ↓
WhatsApp API
      ↓
Download Image
      ↓
Validate
      ↓
Compress/Optimize
      ↓
S3/R2
      ↓
Store URL

Property images should never depend permanently on WhatsApp media URLs.

Store them in your own object storage.

⸻

15. AI Property Extraction

Create:

PropertyAIService

Input:

{
  "text": "3bhk flat in whitefield 1800 sqft 1.5 cr",
  "images": [
    "image-url-1",
    "image-url-2"
  ]
}

Return structured JSON:

{
  "propertyType": "apartment",
  "listingType": "sale",
  "configuration": "3 BHK",
  "location": {
    "locality": "Whitefield",
    "city": "Bangalore",
    "state": "Karnataka"
  },
  "area": {
    "value": 1800,
    "unit": "sqft"
  },
  "price": {
    "amount": 15000000,
    "currency": "INR"
  },
  "furnishing": "semi_furnished",
  "parking": 2,
  "amenities": [],
  "title": "3 BHK Apartment in Whitefield",
  "description": ""
}

Use structured output / schema validation.

⸻

16. AI Enrichment

AI can generate:

Title

Premium 3 BHK Apartment in Whitefield

Description

Create a professional description from provided information.

Highlights

3 BHK
1,800 sq.ft.
Semi Furnished
2 Parking
Whitefield

SEO

Generate:

metaTitle
metaDescription
slug

AI must ONLY derive factual claims from supplied information.

⸻

17. Critical AI Safety Rule

Never fabricate:

Price
Area
Location
Amenities
Parking
Floor
Ownership
RERA status
Legal status
Possession status
Builder
Project name
Property availability

If information is not available:

null

or:

Not provided

Do not guess.

AI-generated fields should have metadata:

{
  "source": "ai",
  "confidence": 0.96
}

Broker-provided fields:

{
  "source": "broker"
}

⸻

18. Property Draft

After AI processing:

WhatsApp
     ↓
AI
     ↓
Property Draft

Never automatically publish in MVP.

Property status:

draft

Example:

{
  "tenantId": "tenant_123",
  "source": {
    "type": "whatsapp",
    "messageId": "wamid.xxx"
  },
  "status": "draft",
  "title": "3 BHK Apartment in Whitefield",
  "propertyType": "apartment",
  "price": 15000000,
  "area": {
    "value": 1800,
    "unit": "sqft"
  }
}

⸻

19. Broker WhatsApp Notification

After processing, send a WhatsApp message to the broker.

Example:

✅ Property Draft Ready
3 BHK Apartment
Whitefield, Bangalore
₹1.50 Cr
1,800 sq.ft.
Semi Furnished
2 Parking
AI confidence: 96%
Review your listing:
[Review Property]

The button should open the authenticated broker dashboard.

⸻

20. Broker Review Screen

Route:

/dashboard/properties/[id]/review

Display:

AI Generated Property
[Property Images]
Title
[Premium 3 BHK Apartment in Whitefield]
Property Type
[Apartment]
Listing Type
[Sale]
BHK
[3]
Area
[1,800 sqft]
Price
[₹1.50 Cr]
Location
[Whitefield, Bangalore]
Furnishing
[Semi Furnished]
Parking
[2]
Description
[...]
Amenities
[...]
[Save Draft]
[Publish Property]

AI-generated fields should show:

AI Generated

badge.

Allow the broker to edit every field.

⸻

21. Publish Flow

When broker clicks:

Publish Property

Perform:

Validate property
       ↓
Generate propertyId
       ↓
Generate slug
       ↓
Set status = active
       ↓
Create public URL
       ↓
Track publish event

Example:

rehanbrokers.propflow.in/property/3bhk-whitefield

⸻

22. Broker Catalog

Dashboard:

Properties
[+ Add Property]
Search properties...
Filters:
Location
Type
Sale/Rent
Price
Status
BHK

Property cards:

┌──────────────────────────────┐
│       PROPERTY IMAGE         │
│                              │
│  ₹1.50 Cr                    │
│  3 BHK Apartment             │
│  Whitefield, Bangalore       │
│  1,800 sq.ft.                │
│                              │
│  ● Active                    │
│                              │
│  Views: 824                  │
│  WhatsApp Leads: 42          │
│                              │
│  [Edit] [Share]              │
└──────────────────────────────┘

⸻

23. Property Lifecycle

Implement:

draft
active
reserved
sold
rented
delisted

Transitions:

DRAFT
 ↓
ACTIVE
 ↓
RESERVED
 ↓
SOLD
ACTIVE
 ↓
DELISTED

Broker can manually change status.

⸻

24. Public Broker Website

Each broker gets:

{brokerSlug}.propflow.in

Example:

rehanbrokers.propflow.in

Homepage:

Rehan Properties
Residential & Commercial Properties
Bangalore
[Search Properties]
Featured Properties
Collections
About Broker
Contact

⸻

25. Public Property Page

Route:

/[brokerSlug]/property/[propertySlug]

Include:

Image Gallery
Property Title
Price
Location
BHK
Area
Property Type
Amenities
Description
Location Map
Broker Profile
WhatsApp CTA
Similar Properties

Premium visual design.

Mobile-first.

⸻

26. WhatsApp Customer CTA

Reusable component:

<WhatsAppButton
  brokerPhone={broker.whatsappNumber}
  property={property}
/>

Generate:

https://wa.me/{phone}?text={encodedMessage}

Message:

Hi Rehan,
I'm interested in:
3 BHK Premium Apartment
Whitefield
₹1.50 Cr
Property ID: REH-1024
Property Link:
https://rehanbrokers.propflow.in/property/3bhk-whitefield

When the customer clicks this CTA:

property_viewed
       ↓
whatsapp_clicked

should be tracked.

⸻

27. Collections

Broker can create:

Whitefield Properties
Luxury Villas
Commercial Properties
Plots Under ₹1 Crore
3 BHK Properties
Investment Properties

Collection URL:

rehanbrokers.propflow.in/collections/whitefield

Allow:

Create
Edit
Delete
Add property
Remove property
Reorder

⸻

28. Smart Collections

Later support dynamic filters:

Location = Whitefield
Property Type = Apartment
BHK = 3
Status = Active

Automatically include matching properties.

Keep this modular so it can be enabled later.

⸻

29. Broker Dashboard

Sidebar:

PropFlow
Dashboard
Properties
Collections
WhatsApp
Leads
Analytics
----------------
Settings
Billing

Dashboard metrics:

Total Properties
Active Properties
Sold Properties
Property Views
WhatsApp Leads

⸻

30. WhatsApp Inbox

Create:

/dashboard/whatsapp

UI:

WhatsApp Inbox
Conversations
Rehan Properties
New Property
3 BHK Whitefield
₹1.5 Cr
--------------------------------
Property Draft
3 BHK Apartment
Whitefield
1,800 sqft
₹1.50 Cr
[Review Property]

Show processing states:

Received
Processing
AI Processing
Draft Ready
Reviewed
Published
Failed

⸻

31. Leads

Whenever a customer clicks WhatsApp:

Create a lead:

{
  "tenantId": "tenant_123",
  "propertyId": "property_123",
  "source": "property_page",
  "sourceUrl": "...",
  "createdAt": "..."
}

Dashboard:

Property
Customer Interest
Date
Source
Status

Lead statuses:

New
Contacted
Qualified
Closed

⸻

32. Analytics

Track:

landing_page_view
signup_started
signup_completed
whatsapp_message_received
property_ai_processing_started
property_ai_processing_completed
property_created
property_published
property_viewed
whatsapp_clicked
collection_viewed
lead_created

Create reusable:

trackEvent(eventName, properties)

Do not tightly couple analytics to a specific provider.

⸻

33. Broker Branding

Broker settings:

Business Name
Logo
Profile Image
Description
Phone
WhatsApp
Email
City
Website
Primary Brand Color

Public website uses these values.

⸻

34. Custom Domain

Prepare architecture for:

rehanproperties.com

instead of:

rehanbrokers.propflow.in

Implement domain mapping abstraction.

Do not make custom domain support a blocker for MVP.

⸻

35. Database Models

Create:

User
Tenant
Broker
Property
Collection
Lead
WhatsAppConversation
WhatsAppMessage
Media
Subscription
AnalyticsEvent
Domain

⸻

36. WhatsAppConversation

interface WhatsAppConversation {
  tenantId: string;
  phoneNumber: string;
  brokerPhoneNumber: string;
  lastMessageAt: Date;
  status: "active" | "archived";
}

⸻

37. WhatsAppMessage

interface WhatsAppMessage {
  tenantId: string;
  messageId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type:
    | "text"
    | "image"
    | "video"
    | "document"
    | "location";
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  processingStatus:
    | "pending"
    | "processing"
    | "completed"
    | "failed";
  createdAt: Date;
}

⸻

38. Property Model

interface Property {
  tenantId: string;
  propertyId: string;
  title: string;
  slug: string;
  propertyType:
    | "apartment"
    | "flat"
    | "villa"
    | "bungalow"
    | "house"
    | "plot"
    | "office"
    | "shop"
    | "warehouse"
    | "commercial"
    | "other";
  listingType: "sale" | "rent";
  status:
    | "draft"
    | "active"
    | "reserved"
    | "sold"
    | "rented"
    | "delisted";
  price?: {
    amount: number;
    currency: "INR";
  };
  area?: {
    value: number;
    unit: "sqft" | "sqm";
  };
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  furnishing?: string;
  location?: {
    address?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
  };
  amenities: string[];
  images: string[];
  videos: string[];
  description?: string;
  source?: {
    type: "whatsapp" | "dashboard" | "api";
    messageId?: string;
  };
  aiMetadata?: {
    generatedFields: string[];
    confidenceScore?: number;
  };
  collectionIds: string[];
  views: number;
  whatsappClicks: number;
  createdAt: Date;
  updatedAt: Date;
}

⸻

39. AI Service Architecture

Create:

services/
  ai/
    property-extraction.service.ts
    property-enrichment.service.ts
    property-validation.service.ts

Pipeline:

Raw WhatsApp Data
       ↓
Extraction
       ↓
Validation
       ↓
Enrichment
       ↓
Structured Property

Keep AI provider abstraction:

interface AIProvider {
  extractProperty(input: PropertyAIInput): Promise<PropertyAIOutput>;
  enrichProperty(input: PropertyAIInput): Promise<PropertyAIOutput>;
}

This allows changing AI providers later.

⸻

40. WhatsApp Service Architecture

Create:

services/
  whatsapp/
    whatsapp.service.ts
    whatsapp-webhook.service.ts
    whatsapp-media.service.ts
    whatsapp-template.service.ts

Provider abstraction:

interface WhatsAppProvider {
  sendMessage(...);
  sendTemplate(...);
  downloadMedia(...);
  verifyWebhook(...);
}

Implement Meta Cloud API first.

⸻

41. Queue Architecture

Use BullMQ.

Queues:

whatsapp-message-processing
whatsapp-media-processing
property-ai-processing
property-image-processing
analytics-processing

Example:

Webhook
   ↓
Queue
   ↓
Worker
   ↓
AI
   ↓
MongoDB

Never block the WhatsApp webhook while AI is processing.

⸻

42. Error Handling

If AI processing fails:

Property status = draft
Processing status = failed

Broker should see:

We couldn't automatically process this property.
[Review Manually]
[Retry AI Processing]

If WhatsApp media download fails:

Media processing failed
[Retry]

⸻

43. Idempotency

WhatsApp webhooks can be retried.

Prevent duplicate processing using:

WhatsApp messageId

Before processing:

if messageId already exists:
    return success

This is mandatory.

⸻

44. Security

Implement:

* Tenant isolation
* Authentication
* Authorization
* RBAC
* Webhook verification
* API rate limiting
* Input validation
* File validation
* File size limits
* Signed media URLs
* Secure environment variables
* Audit logs

Never expose:

AI API keys
WhatsApp access tokens
Database credentials
Internal service credentials

⸻

45. Landing Page Design

Use a premium SaaS visual style:

* White/light background
* Strong typography
* Subtle neutral colors
* Premium real-estate imagery only where useful
* Rounded cards
* Soft shadows
* Minimal gradients
* High whitespace
* Professional animations

Avoid:

* Generic template appearance
* Excessive gradients
* Excessive glassmorphism
* Over-animation
* Clutter
* Generic stock-photo-heavy design

The product visualization should be the main visual asset.

⸻

46. Mobile Experience

Prioritize mobile.

Broker will frequently use the product from their phone.

The following must work exceptionally well on mobile:

Dashboard
Property creation
Image upload
AI review
Publish
WhatsApp workflow
Property sharing

⸻

47. SEO

Landing page:

* Metadata
* OpenGraph
* Structured data

Public broker pages:

* Dynamic metadata

Property pages:

* Dynamic title
* Description
* Canonical URL
* OpenGraph property image
* Structured data where appropriate

Example:

/rehanbrokers/property/3-bhk-whitefield

⸻

48. Performance

Use:

* Next.js Server Components where appropriate
* Next/Image
* Lazy loading
* CDN-backed images
* Database indexes
* Pagination
* Redis caching where useful
* Background jobs

Avoid unnecessary client-side JavaScript.

⸻

49. MVP Pricing UI

Display:

Free

₹0/month

* 10 properties
* Broker profile
* Basic listings
* WhatsApp CTA

Pro

₹1,499/month

* 250 properties
* AI enrichment
* Collections
* Analytics
* Lead tracking

Business

₹3,999/month

* Large inventory
* Custom domain
* Team members
* Advanced analytics
* API access

Payment integration can remain mocked initially.

⸻

50. Complete MVP Flow

The most important acceptance test is:

1. User visits landing page
        ↓
2. Clicks Start Free
        ↓
3. Creates broker account
        ↓
4. Gets broker workspace
        ↓
5. Connects WhatsApp Business number
        ↓
6. Broker sends WhatsApp message
"3BHK flat in Whitefield
1800 sqft
₹1.5 Cr"
+ Images
        ↓
7. Meta sends webhook
        ↓
8. Webhook stores message
        ↓
9. BullMQ creates processing job
        ↓
10. Worker downloads images
        ↓
11. AI extracts property information
        ↓
12. AI enriches title/description
        ↓
13. Property Draft created
        ↓
14. Broker receives WhatsApp notification
        ↓
15. Broker opens Review Property
        ↓
16. Broker edits if necessary
        ↓
17. Broker clicks Publish
        ↓
18. Property becomes ACTIVE
        ↓
19. Public URL generated
        ↓
20. Broker shares URL on WhatsApp
        ↓
21. Customer opens listing
        ↓
22. Customer clicks WhatsApp
        ↓
23. Lead is recorded
        ↓
24. WhatsApp opens with property context

⸻

51. Important Product Rule

The product should augment the broker’s existing WhatsApp workflow, not force the broker to learn a complex CRM.

The core loop must remain:

SEND ON WHATSAPP
        ↓
AI ORGANIZES
        ↓
BROKER REVIEWS
        ↓
PUBLISH
        ↓
SHARE LINK
        ↓
CUSTOMER CONTACTS BROKER

Everything else is secondary.

⸻

52. Build Priority

Implement in this order:

Phase 1 — Foundation

1. Next.js setup
2. Design system
3. Authentication
4. Tenant architecture
5. MongoDB models

Phase 2 — Core Product

6. Dashboard
7. Property CRUD
8. Image upload
9. Public broker page
10. Public property page
11. Collections

Phase 3 — AI

12. AI provider abstraction
13. Property extraction
14. Property enrichment
15. AI review screen
16. Draft → Publish workflow

Phase 4 — WhatsApp

17. Meta WhatsApp Cloud API
18. Webhook
19. Message storage
20. Media download
21. BullMQ processing
22. AI processing
23. Broker notification
24. WhatsApp inbox

Phase 5 — Leads

25. WhatsApp CTA
26. Lead tracking
27. Lead dashboard
28. Analytics

Phase 6 — SaaS

29. Subscription architecture
30. Custom domains
31. Broker branding
32. Admin dashboard

⸻

53. Final Development Instruction

Build the application incrementally and keep every layer replaceable.

Do not create a monolithic component.

Do not hardcode broker data.

Do not hardcode WhatsApp credentials.

Do not automatically publish AI-generated properties.

Do not fabricate property information.

Do not make WhatsApp processing synchronous.

Do not expose private WhatsApp messages publicly.

The final MVP should demonstrate the complete real-world workflow:

WhatsApp → Webhook → Queue → Media → AI → Property Draft → Broker Review → Publish → Public Catalog → Customer → WhatsApp Lead.