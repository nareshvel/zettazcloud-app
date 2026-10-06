/**
 * industryMapping
 * -----------------------------------------------------------------------------
 * Maps the onboarding "business type" (a marketing-facing list) to the platform
 * `industry_types.code` used to drive dynamic product fields and menu visibility.
 *
 * Keep this as the single place the two vocabularies meet.
 */

'use strict';

const BUSINESS_TYPE_TO_INDUSTRY = {
  retail: 'general_retail',
  other: 'general_retail',
  marketstall: 'general_retail',
  jewelry: 'jewelry',
  jewellery: 'jewelry',
  clothing: 'apparel',
  apparel: 'apparel',
  electronics: 'electronics',
  grocery: 'grocery',
  supermarket: 'grocery',
  pharmacy: 'pharmacy',
  souvenir_gifts: 'souvenir_gifts',
  souvenir: 'souvenir_gifts',
  souvenirs: 'souvenir_gifts',
  giftshop: 'souvenir_gifts',
  gifts: 'souvenir_gifts',
  // Food service verticals are served by the separate iRestrack product; map them
  // to general retail so Zettaz still works if such a tenant signs up.
  restaurant: 'general_retail',
  cafe: 'general_retail',
  foodtruck: 'general_retail',
};

const DEFAULT_INDUSTRY = 'general_retail';

function toIndustryCode(businessType) {
  if (!businessType) return DEFAULT_INDUSTRY;
  return BUSINESS_TYPE_TO_INDUSTRY[String(businessType).toLowerCase()] || DEFAULT_INDUSTRY;
}

module.exports = { BUSINESS_TYPE_TO_INDUSTRY, DEFAULT_INDUSTRY, toIndustryCode };
