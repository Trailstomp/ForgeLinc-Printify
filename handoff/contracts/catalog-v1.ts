/** Proposed domain contracts. Not installed in the source app; add runtime validation in the host. */
export type ID = string;
export type ProductionMode = 'merch' | '3d-print';
export type Channel = 'lincwerks' | 'gearlinc' | 'gamelinc' | 'tournamentlinc';
export interface Money { amountMinor: number; currency: string }
export interface AssetRef { id: ID; sha256: string; mediaType: string }
export interface ChannelContext { channel: Channel; teamId?: ID; eventId?: ID }
export interface ProductLine { id: ID; organizationId: ID; name: string; mode: ProductionMode }
export interface PrintRegion {
  id: ID; label: string; widthPx: number; heightPx: number;
  safeAreaAsset?: AssetRef; bleedAsset?: AssetRef; decorationMethod: string;
}
export type Blueprint = {
  id: ID; organizationId: ID; revision: number; name: string;
} & ({
  mode: 'merch'; provider: string; providerBlueprintId: ID; providerPrintProviderId: ID;
  regionSets: { providerVariantId: ID; regions: PrintRegion[] }[];
} | {
  mode: '3d-print'; allowedMaterials: string[]; process: string;
  limitsMm: { x: number; y: number; z: number }; approvedModelRequired: true;
});
export interface TemplateRevision {
  id: ID; organizationId: ID; blueprintId: ID; blueprintRevision: number;
  revision: number; rendererVersion: string; assets: AssetRef[];
  designDocument: Record<string, unknown>; // adapter-specific validated schema
}
export interface ProviderMapping {
  provider: string; storeId: ID; productId: ID; variantId: ID;
}
export interface Variant {
  id: ID; options: Record<string, string>; price: Money;
  readiness: 'draft' | 'needs-review' | 'ready' | 'unavailable';
  provider?: ProviderMapping;
  commerce?: { platform: string; storeId: ID; productId: ID; variantId: ID };
}
export interface CatalogProduct {
  id: ID; organizationId: ID; productLineId: ID; templateRevisionId: ID;
  title: string; mode: ProductionMode; variants: Variant[];
  personalization: { allowCustomerUploads: boolean; fields: string[]; alternateAssetIds: ID[] };
  displayAssetIds: ID[];
}
export interface Collection { id: ID; organizationId: ID; name: string; productIds: ID[] }
export interface Publication {
  id: ID; organizationId: ID; collectionId: ID; context: ChannelContext;
  state: 'draft' | 'scheduled' | 'published' | 'withdrawn';
  startsAt?: string; endsAt?: string; revision: number;
}
export type Destination = { kind: 'product' | 'collection'; id: ID };
export interface Campaign {
  id: ID; organizationId: ID; kind: 'house' | 'sponsor';
  target: Destination; contexts: ChannelContext[]; sceneIds: ID[]; slotIds: ID[];
  creativeAssetId: ID; accessibleLabel: string;
  state: 'draft' | 'active' | 'paused' | 'ended'; startsAt?: string; endsAt?: string;
  priority: number; rotationWeight: number;
}
export interface ScenePlacement {
  id: ID; sceneId: ID; fixture: 'rack' | 'mannequin' | 'hat-display' | 'shelf' | 'counter' | 'pedestal' | 'billboard';
  productId?: ID; campaignSlotId?: ID;
  position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number];
}
/** Construct on the server after authorization, not by serializing internal CatalogProduct. */
export interface PublicProduct {
  id: ID; title: string; mode: ProductionMode;
  variants: { id: ID; options: Record<string, string>; price: Money; purchasable: boolean }[];
  displayUrls: string[];
  personalization: CatalogProduct['personalization'];
}
export interface CatalogResponse {
  revision: string; context: ChannelContext;
  collections: { id: ID; name: string; productIds: ID[] }[];
  products: PublicProduct[];
}
export interface PurchasedDesign {
  id: ID; organizationId: ID; orderId: ID; orderLineId: ID; productId: ID; variantId: ID;
  templateRevisionId: ID; rendererVersion: string; quantity: number;
  resolvedDesign: Record<string, unknown>; assets: AssetRef[];
  manifestHash: string; printFiles: { regionId: ID; asset: AssetRef }[];
}
export interface ProductionJob {
  id: ID; organizationId: ID; purchasedDesignId: ID; mode: ProductionMode;
  state: 'queued' | 'preparing' | 'needs-review' | 'approved' | 'submitted' | 'in-production' | 'shipped' | 'held' | 'failed' | 'cancelled';
  isTestOrder: boolean; manifestHash: string; approvedManifestHash?: string;
  externalOrderId?: ID; idempotencyKey: string; revision: number;
}
