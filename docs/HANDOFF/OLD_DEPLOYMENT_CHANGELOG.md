# Zettaz Cloud POS - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2025-11-01

### Added
- Mobile dropdown navigation for Settings page (replaces vertical tab list)
- Version display component (dev mode only)
- Deployment documentation structure
- Image URL normalization utility for localhost/production compatibility

### Changed
- **Mobile UI Improvements**:
  - Toggle button: Smaller size (18px icons), dimmer background (gray-700)
  - Metric cards: Enhanced design with gradients, borders, and shadows
  - Metric card labels: Shortened text ("Active Products", "Low Stock", "Out of Stock")
  - Settings page: Optimized padding and spacing for mobile
  - Settings navigation: Dropdown select on mobile, sidebar on desktop
- Product edit: Stock quantity field now properly excluded from updates (use Stock Adjustment feature)
- ProductFormModal: Now uses `normalizeImageUrl` utility for consistent image handling

### Fixed
- Product image display in edit modal (localhost URLs converted to production)
- Product edit error when uploading images (stock quantity validation)
- Settings page mobile responsiveness (content immediately visible)
- Mixed content warnings for product images

### Removed
- Verbose console.log statements from production build
- Redundant section title on mobile Settings page
- Manual image URL handling in ProductFormModal (replaced with utility)

---

## [1.0.0] - 2025-10-XX

### Added
- Initial release
- POS Screen with cart functionality
- Product management with CRUD operations
- Customer management
- Order management
- Tax configuration
- Payment gateway integration
- Multi-language support (i18n)
- Responsive design for desktop and tablet

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes, major feature releases
- **Minor (1.X.0)**: New features, non-breaking changes
- **Patch (1.0.X)**: Bug fixes, minor improvements

---

## Deployment Notes

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions and version update procedures.
