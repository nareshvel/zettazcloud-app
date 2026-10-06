import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, ArrowRight, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Category, Product } from '@/types';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getProducts } from '../../services/inventoryService';
import { createProduct, updateProduct } from '../../services/productService';
import { getProductFieldSchema, getTenantIndustry, IndustryField } from '../../services/industryService';
import { createPiece } from '../../services/productPieceService';

interface ProductImportProps {
  categories?: Category[];
  onClose: () => void;
  onImportSuccess?: () => void;
}

type DuplicateHandling = 'skip' | 'update' | 'error';

interface ColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'import' | 'complete';

interface MappedField {
  fileColumn: string;
  dbField: string | null;
}

const ProductImport: React.FC<ProductImportProps> = ({ onClose, onImportSuccess }) => { // categories prop kept for future use
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  // const [file, setFile] = useState<File | null>(null); // Unused state variable removed
  const [fileData, setFileData] = useState<Record<string, any>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<MappedField[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  // Pre-import validation, computed for EVERY mapped row (not just the 10
  // shown in the preview table) when moving from mapping -> preview. Catches
  // exactly the failure mode that used to only surface after clicking
  // "Start Import" and hitting the backend: a select-type industry attribute
  // (e.g. Size) whose spreadsheet value doesn't match one of the tenant's
  // configured options. Mirrors industryFieldService.validateAttributes'
  // rules client-side so the user can fix the file before any network call.
  const [previewValidationErrors, setPreviewValidationErrors] = useState<
    { row: number; product: string; errors: string[] }[]
  >([]);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; skipped: number; updated: number }>({ success: 0, errors: 0, skipped: 0, updated: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('skip');
  // Matches ProductFormModal.tsx's create-time default (2026-09-08): a new
  // product is shared across all stores unless restricted. Applies to every
  // newly-created row from this import; existing products found via
  // duplicate-SKU matching keep whatever sharing status they already have
  // (store_id can't be changed after creation via the update endpoint).
  const [shareAcrossStores, setShareAcrossStores] = useState<boolean>(true);

  // Tenant's industry-specific attribute fields (e.g. jewelry: purity, gross
  // weight, HSN code, ...), resolved server-side via industryFieldService and
  // rendered here as extra mappable columns feeding products.attributes JSON
  // — same schema the manual Add Product form uses (DynamicProductFields.tsx).
  const [industryFields, setIndustryFields] = useState<IndustryField[]>([]);
  // Tenant's industry code — used to conditionally offer the pieceBarcode
  // column (serialized pieces are jewelry/electronics only; the backend's
  // /api/product-pieces routes are gated behind requireIndustry).
  const [tenantIndustry, setTenantIndustry] = useState<string>('general_retail');
  useEffect(() => {
    getProductFieldSchema('product')
      .then((schema) => setIndustryFields(schema.fields || []))
      .catch((err) => console.error('Failed to load industry field schema for import:', err));
    getTenantIndustry()
      .then((code) => setTenantIndustry(code || 'general_retail'))
      .catch((err) => console.error('Failed to load tenant industry for import:', err));
  }, []);

  // Whether any row provides a Piece Barcode/Code — if so, that row creates a
  // serialized piece (product_pieces) instead of just setting stock_quantity.
  // Column key prefix for industry attribute columns.
  const ATTR_PREFIX = 'attr_';

  const baseColumnDefinitions: ColumnDefinition[] = [
    { key: 'name', label: 'Product Name', required: true, description: 'The name of the product', example: 'Organic Apple' },
    { key: 'categoryName', label: 'Category Name', required: false, description: 'The name of the product category', example: 'Fruits' },
    { key: 'price', label: 'Price', required: true, description: 'The selling price of the product', example: '2.99' },
    { key: 'description', label: 'Description', required: false, description: 'A detailed description of the product', example: 'Fresh organic apples from local farms' },
    { key: 'costPrice', label: 'Cost Price', required: false, description: 'Flat cost price of the product (use Purchase Price + Handling % instead if you use cost-code pricing)', example: '1.50' },
    { key: 'purchasePrice', label: 'Purchase Price', required: false, description: 'Raw purchase price, used with Handling % and Markup % to derive cost/selling price via cost-code pricing', example: '1.20' },
    { key: 'handlingCostPct', label: 'Handling Cost %', required: false, description: 'Handling cost percentage applied on top of Purchase Price to get the cost price', example: '5' },
    { key: 'markupPct', label: 'Markup %', required: false, description: 'Markup percentage applied on top of cost price to get the selling price (informational — Price column is still what is saved as the selling price)', example: '25' },
    { key: 'barcode', label: 'Barcode', required: false, description: 'The product barcode (EAN, UPC, etc.)', example: '5901234123457' },
    { key: 'sku', label: 'SKU', required: false, description: 'Stock Keeping Unit - a unique identifier', example: 'APP-ORG-001' },
    { key: 'stockQuantity', label: 'Stock Quantity', required: false, description: 'Current inventory level (ignored for rows that create a serialized piece — the piece count drives stock instead)', example: '100' },
    { key: 'taxClass', label: 'Tax Class', required: false, description: 'Tax classification name', example: 'Standard' },
    { key: 'imageUrl', label: 'Image URL', required: false, description: 'URL to product image', example: 'https://example.com/image.jpg' },
    { key: 'lowStockThreshold', label: 'Low Stock Alert', required: false, description: 'Threshold for low stock warning', example: '10' },
    { key: 'isActive', label: 'Is Active', required: false, description: 'Product visibility (true/false)', example: 'true' },
    { key: 'trackInventory', label: 'Track Inventory', required: false, description: 'Enable inventory tracking (true/false)', example: 'true' },
    // Serialized piece column — only available for jewelry/electronics tenants
    // (the backend's /api/product-pieces routes are gated behind
    // requireIndustry(['jewelry', 'electronics'])). Offering it for other
    // industries causes a confusing "not available for your business type"
    // error at import time.
    ...(tenantIndustry === 'jewelry' || tenantIndustry === 'electronics'
      ? [{ key: 'pieceBarcode', label: 'Piece Barcode/Serial', required: false, description: 'If set, this row creates one serialized piece (product_pieces) for the product instead of setting a flat stock quantity — for individually-tracked items', example: 'PC-ABC123' }]
      : []),
  ];

  // Industry attribute columns become part of the mappable list, prefixed so
  // they can't collide with the fixed keys above; values are collected back
  // into a single `attributes` JSON object per row on import.
  const attributeColumnDefinitions: ColumnDefinition[] = industryFields.map((f) => ({
    key: `${ATTR_PREFIX}${f.fieldKey}`,
    label: f.label,
    required: false, // required-ness is enforced server-side per tenant config, not at mapping time
    description: `Industry attribute (${f.dataType}${f.unit ? `, ${f.unit}` : ''})${f.isRequired ? ' — required by your tenant config' : ''}`,
    example: f.dataType === 'number' || f.dataType === 'decimal' ? '1.5' : f.dataType === 'boolean' ? 'true' : 'sample',
  }));

  const columnDefinitions: ColumnDefinition[] = [...baseColumnDefinitions, ...attributeColumnDefinitions];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await selectedFile.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast.error('No worksheet found in the file');
        setIsProcessing(false);
        return;
      }
      
      // Extract headers and data
      const json: Record<string, any>[] = [];
      const headers: string[] = [];
      
      // Get headers from the first row
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text.trim();
      });
      
      // Process each row into a JSON object
      let rowCount = 0;
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          rowCount++;
          const rowData: Record<string, any> = {};
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              rowData[header] = cell.text;
            }
          });
          json.push(rowData);
        }
      });
      
      if (json.length === 0) {
        toast.error('The uploaded file contains no data');
        setIsProcessing(false);
        return;
      }
      
      // Extract column headers
      const columns = headers.filter(Boolean); // Filter out empty headers
      setFileColumns(columns);
      setFileData(json);
      
      // Auto map columns based on similar names
      const initialMapping = columns.map(column => {
        // Try to find a matching column definition
        const matchedDef = columnDefinitions.find(def => 
          def.key.toLowerCase() === column.toLowerCase() || 
          def.label.toLowerCase() === column.toLowerCase()
        );
        
        return {
          fileColumn: column,
          dbField: matchedDef ? matchedDef.key : null
        };
      });
      
      setMappedFields(initialMapping);
      setStep('mapping');
    } catch (error) {
      toast.error('Failed to parse the spreadsheet file');
      console.error('File parsing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const downloadTemplate = async () => {
    setIsProcessing(true);
    try {
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Products');

      // Extract headers and example data
      const headers = columnDefinitions.map(col => col.label);
      const exampleRow = columnDefinitions.map(col => col.example);

      // Add headers as the first row
      worksheet.addRow(headers);
      
      // Make the header row bold
      worksheet.getRow(1).font = { bold: true };
      
      // Add example data as the second row
      worksheet.addRow(exampleRow);
      
      // Auto-size columns based on content
      worksheet.columns.forEach((column, index) => {
        let maxLength = headers[index].length;
        if (exampleRow[index] && exampleRow[index].length > maxLength) {
          maxLength = exampleRow[index].length;
        }
        column.width = maxLength + 4; // Add some padding
      });
      
      // Generate the Excel file as a buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Use file-saver to trigger download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'product_import_template.xlsx');
      
      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Failed to generate template:', error);
      toast.error('Failed to generate template');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (fileColumn: string, dbField: string | null) => {
    setMappedFields(prev => 
      prev.map(mf => mf.fileColumn === fileColumn ? { ...mf, dbField } : mf)
    );
  };

  const validateMapping = (): boolean => {
    const requiredDbFields = columnDefinitions.filter(cd => cd.required).map(cd => cd.key);
    const mappedDbFields = mappedFields.map(mf => mf.dbField).filter(Boolean);

    for (const reqField of requiredDbFields) {
      if (!mappedDbFields.includes(reqField)) {
        toast.error(`Required field '${columnDefinitions.find(cd => cd.key === reqField)?.label}' is not mapped.`);
        return false;
      }
    }
    return true;
  };

  // Validates every mapped row against the tenant's industry attribute
  // schema (required-ness + select options) before the import ever hits the
  // network. Same rules as the backend's industryFieldService.validateAttributes,
  // duplicated client-side deliberately — this is a UX pre-check, not the
  // security boundary, so the backend still re-validates on POST regardless.
  const validateAllRows = (rows: Record<string, any>[]): { row: number; product: string; errors: string[] }[] => {
    const results: { row: number; product: string; errors: string[] }[] = [];
    rows.forEach((row, idx) => {
      const rowErrors: string[] = [];
      const productName = row.name || `(row ${idx + 1})`;

      // Base required fields (mirrors baseColumnDefinitions' required flags) —
      // catches a row where the column IS mapped but a specific cell is blank,
      // which validateMapping (mapping-time only) can't see.
      if (!row.name || String(row.name).trim() === '') {
        rowErrors.push('Product Name is required');
      }
      if (row.price === undefined || row.price === null || String(row.price).trim() === '') {
        rowErrors.push('Price is required');
      } else if (Number.isNaN(Number(row.price))) {
        rowErrors.push('Price must be a number');
      }

      // Industry attribute fields (attr_ prefixed) — required + select options.
      for (const f of industryFields) {
        const key = `${ATTR_PREFIX}${f.fieldKey}`;
        const raw = row[key];
        const empty = raw === undefined || raw === null || String(raw).trim() === '';
        if (empty) {
          if (f.isRequired) rowErrors.push(`${f.label} is required`);
          continue;
        }
        if (f.dataType === 'select' && Array.isArray(f.options) && f.options.length && !f.options.includes(String(raw))) {
          rowErrors.push(`${f.label} must be one of: ${f.options.join(', ')}`);
        } else if ((f.dataType === 'number' || f.dataType === 'decimal') && Number.isNaN(Number(raw))) {
          rowErrors.push(`${f.label} must be a number`);
        }
      }

      if (rowErrors.length > 0) {
        results.push({ row: idx + 1, product: productName, errors: rowErrors });
      }
    });
    return results;
  };

  const handleNextStep = () => {
    if (step === 'mapping') {
      if (!validateMapping()) return;
      // Prepare data for preview based on mapping
      const newPreviewData = fileData.map((row: Record<string, any>) => {
        const newRow: any = {};
        mappedFields.forEach(mf => {
          if (mf.dbField && row[mf.fileColumn] !== undefined) {
            newRow[mf.dbField] = row[mf.fileColumn];
          }
        });
        return newRow;
      });
      setPreviewValidationErrors(validateAllRows(newPreviewData));
      setPreviewData(newPreviewData.slice(0, 10)); // Show first 10 rows for preview
      setStep('preview');
    } else if (step === 'preview') {
      if (previewValidationErrors.length > 0) {
        toast.error('Fix the highlighted rows before importing, or go back and remap columns.');
        return;
      }
      setStep('import');
      handleImportProducts(); // Automatically start import after preview confirmation
    }
  };

  const handlePreviousStep = () => {
    if (step === 'mapping') setStep('upload');
    if (step === 'preview') setStep('mapping');
    // Cannot go back from 'import' or 'complete' steps
  };

  // Builds the multipart FormData the backend actually expects
  // (POST/PUT /products go through multer + snake_case field names, not
  // JSON with camelCase keys) — mirrors ProductsPage.tsx's
  // handleSaveProduct mapping so import behaves identically to the manual
  // product form. `isNew` controls whether stockQuantity/shareAcrossStores
  // are included (stock changes on an existing product must go through
  // Stock Adjustment so they keep their audit trail; sharing status can't
  // be changed after creation at all).
  const buildProductFormData = (
    productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
    isNew: boolean
  ): FormData => {
    const formData = new FormData();
    const fieldMappings: Record<string, string> = {
      categoryId: 'category_id',
      stockQuantity: 'stock_quantity',
      costPrice: 'purchase_price',
      purchasePrice: 'purchase_price',
      handlingCostPct: 'handling_cost_pct',
      markupPct: 'markup_pct',
      lowStockThreshold: 'low_stock_threshold',
      isActive: 'is_active',
      taxClassId: 'tax_class_id',
      shareAcrossStores: 'share_across_stores',
    };

    const pd: any = { ...productData };
    delete pd.tenantId; // resolved server-side from the auth context
    // purchasePrice (cost-code pricing) takes precedence over the flat legacy
    // costPrice when both somehow got mapped — only one purchase_price value
    // can be sent.
    if (pd.purchasePrice !== undefined) delete pd.costPrice;

    Object.entries(pd).forEach(([key, value]) => {
      if (key === 'stockQuantity' && !isNew) return; // stock via Stock Adjustment only
      if (key === 'shareAcrossStores' && !isNew) return; // immutable after creation
      if (value === undefined || value === null) return;
      if (key === 'attributes') {
        // Already a JSON string built by the caller.
        formData.append('attributes', String(value));
        return;
      }
      const backendKey = fieldMappings[key] || key;
      formData.append(backendKey, String(value));
    });

    return formData;
  };

  const handleImportProducts = async () => {
    if (!user || !user.tenantId) {
      toast.error('User information not found. Please log in again.');
      setStep('complete');
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const currentImportErrors: string[] = [];

    // Fetch the tenant's catalog ONCE and index it by SKU, instead of
    // calling getProductBySku() (which itself fetches the whole catalog)
    // once per row — that was an N+1 API-call pattern that made a 500-row
    // import issue 500 full-catalog requests. A SKU created earlier in this
    // same import run is added to the map as we go, so later rows in the
    // same file still see it as a duplicate.
    const skuIndex = new Map<string, Product>();
    try {
      const existingProducts = await getProducts();
      for (const p of existingProducts) {
        if (p.sku) skuIndex.set(p.sku, p);
      }
    } catch (error) {
      console.error('Failed to preload existing products for duplicate-SKU check:', error);
      // Non-fatal — every row will just be treated as new (no duplicate
      // detected), same fallback behavior getProductBySku() had on error.
    }

    for (let i = 0; i < fileData.length; i++) {
      const row: Record<string, any> = fileData[i];
      // Initialize with tenantId and default values for required boolean fields
      const productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = {
        tenantId: user.tenantId,
        isActive: true, // Default value
        trackInventory: true, // Default value
      };

      // Industry attribute values (attr_<fieldKey> columns) collected
      // separately and sent as a single `attributes` JSON object.
      const rowAttributes: Record<string, any> = {};
      let pieceBarcodeValue: string | undefined;

      mappedFields.forEach(mf => {
        if (mf.dbField && row[mf.fileColumn] !== undefined) {
          // Type conversions and specific field handling
          const value = row[mf.fileColumn];
          if (mf.dbField.startsWith(ATTR_PREFIX)) {
            const fieldKey = mf.dbField.slice(ATTR_PREFIX.length);
            if (value !== undefined && String(value).trim() !== '') {
              rowAttributes[fieldKey] = value;
            }
            return;
          }
          if (mf.dbField === 'pieceBarcode') {
            // Only set pieceBarcodeValue for tenants that support serialized
            // pieces (jewelry/electronics). If a non-supporting tenant's file
            // happens to have a pieceBarcode column mapped, silently ignore it
            // rather than letting the create-piece call fail with a confusing
            // "not available for your business type" error.
            const supportsPieces = tenantIndustry === 'jewelry' || tenantIndustry === 'electronics';
            if (supportsPieces && value !== undefined && String(value).trim() !== '') {
              pieceBarcodeValue = String(value).trim();
            }
            return;
          }
          if (mf.dbField === 'price' || mf.dbField === 'costPrice' || mf.dbField === 'purchasePrice' ||
              mf.dbField === 'handlingCostPct' || mf.dbField === 'markupPct') {
            (productData as any)[mf.dbField] = value !== undefined ? parseFloat(String(value)) : undefined;
          } else if (mf.dbField === 'stockQuantity' || mf.dbField === 'lowStockThreshold') {
            (productData as any)[mf.dbField] = value !== undefined ? parseInt(String(value), 10) : undefined;
          } else if (mf.dbField === 'isActive' || mf.dbField === 'trackInventory') {
            (productData as any)[mf.dbField] = value !== undefined ? String(value).toLowerCase() === 'true' : (productData as any)[mf.dbField]; // Keep default if not in file
          } else if (mf.dbField === 'categoryName') {
            // Handle category - can be category name or ID
            (productData as any)['category_id'] = value; // Backend will handle auto-creation
          } else if (mf.dbField === 'taxClass') {
            // Handle tax class - can be tax class name or ID
            (productData as any)['tax_class_id'] = value; // Backend will handle auto-creation
          } else if (mf.dbField === 'imageUrl') {
            // Handle image URL - validate URL format
            if (value && typeof value === 'string' && value.trim() !== '') {
              const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
              if (urlPattern.test(value.trim())) {
                (productData as any)['image_url'] = value.trim();
              }
            }
          } else {
            (productData as any)[mf.dbField] = value;
          }
        }
      });

      const isSerializedRow = !!pieceBarcodeValue;

      // Basic validation for required fields after mapping
      if (!productData.name || typeof productData.name !== 'string' || productData.name.trim() === '') {
        currentImportErrors.push(`Row ${i + 1}: Missing or invalid Product Name.`);
        continue;
      }
      if (productData.price === undefined || isNaN(Number(productData.price))) {
        currentImportErrors.push(`Row ${i + 1} (Product: ${productData.name}): Missing or invalid Price.`);
        continue;
      }
      if (productData.stockQuantity === undefined || isNaN(Number(productData.stockQuantity))) {
        // Default stockQuantity to 0 if not provided or invalid, or make it a hard error
        // For now, let's make it an error if it's mapped but invalid. If not mapped, it won't be in productData yet.
        const stockQtyField = mappedFields.find(mf => mf.dbField === 'stockQuantity');
        if (stockQtyField && row[stockQtyField.fileColumn] !== undefined && !isSerializedRow) { // if it was in the file but invalid
            currentImportErrors.push(`Row ${i + 1} (Product: ${productData.name}): Invalid Stock Quantity.`);
            continue;
        }
        productData.stockQuantity = 0; // Default if not in file, not mapped, or a serialized-piece row (piece count drives stock instead)
      } else if (isSerializedRow) {
        // A serialized-piece row's stock is driven entirely by product_pieces
        // (synced server-side after piece creation) — ignore any flat stock
        // quantity column value to avoid double-counting.
        productData.stockQuantity = 0;
      }

      // Final product object for creation
      const finalProductData = productData as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

      // Ensure required fields that might not have been in the loop (like defaults) are numbers if expected
      finalProductData.price = Number(finalProductData.price);
      if (finalProductData.costPrice !== undefined) finalProductData.costPrice = Number(finalProductData.costPrice);
      if ((finalProductData as any).purchasePrice !== undefined) (finalProductData as any).purchasePrice = Number((finalProductData as any).purchasePrice);
      if ((finalProductData as any).handlingCostPct !== undefined) (finalProductData as any).handlingCostPct = Number((finalProductData as any).handlingCostPct);
      if ((finalProductData as any).markupPct !== undefined) (finalProductData as any).markupPct = Number((finalProductData as any).markupPct);
      finalProductData.stockQuantity = Number(finalProductData.stockQuantity);
      if (finalProductData.lowStockThreshold !== undefined) finalProductData.lowStockThreshold = Number(finalProductData.lowStockThreshold);
      if (Object.keys(rowAttributes).length > 0) {
        (finalProductData as any).attributes = JSON.stringify(rowAttributes);
      }

      // Handle duplicate SKU logic — looked up from the in-memory index built
      // once above, not a fresh full-catalog fetch per row.
      let existingProduct: Product | null = null;
      if (finalProductData.sku) {
        existingProduct = skuIndex.get(finalProductData.sku) || null;
      }

      // Creates one product_pieces row for a serialized-piece row, reusing
      // gross_weight/net_weight/purity from the industry attribute columns
      // when present (these are the same field keys the jewelry industry
      // schema seeds — see industryFieldService). Pieces are created one at
      // a time (not via /bulk) because each import row typically carries its
      // own distinct weight/purity/price, unlike /bulk's identical-N-pieces
      // shape.
      const createPieceForRow = async (productId: string) => {
        await createPiece({
          productId,
          barcode: pieceBarcodeValue,
          grossWeight: rowAttributes['gross_weight'] !== undefined ? Number(rowAttributes['gross_weight']) : undefined,
          netWeight: rowAttributes['net_weight'] !== undefined ? Number(rowAttributes['net_weight']) : undefined,
          purity: rowAttributes['purity'] !== undefined ? String(rowAttributes['purity']) : undefined,
          purchasePrice: (finalProductData as any).purchasePrice ?? finalProductData.costPrice,
          costPrice: finalProductData.costPrice,
          sellingPrice: finalProductData.price,
          attributes: Object.keys(rowAttributes).length > 0 ? rowAttributes : undefined,
        } as any);
      };

      if (existingProduct && finalProductData.sku) {
        // Product with this SKU already exists
        if (duplicateHandling === 'skip' && !isSerializedRow) {
          console.log(`Skipping row ${i + 1}: Product with SKU ${finalProductData.sku} already exists`);
          skippedCount++;
          continue;
        } else if (duplicateHandling === 'error' && !isSerializedRow) {
          currentImportErrors.push(`Row ${i + 1} (${productData.name || 'N/A'}): Product with SKU ${finalProductData.sku} already exists`);
          continue;
        } else if (isSerializedRow) {
          // A serialized-piece row against an existing SKU always just adds
          // one more piece to that product — "skip/update/error" duplicate
          // handling doesn't apply the same way, since the row isn't
          // describing the product itself, just one more unit of it.
          try {
            await createPieceForRow(existingProduct.id);
            successCount++;
          } catch (error: any) {
            console.error(`Error creating piece for row ${i + 1}:`, error);
            currentImportErrors.push(`Row ${i + 1} (${productData.name || 'N/A'}): Failed to create piece - ${error.message || 'Unknown error'}`);
          }
          continue;
        } else if (duplicateHandling === 'update') {
          try {
            await updateProduct(existingProduct.id, buildProductFormData(finalProductData, false));
            updatedCount++;
          } catch (error: any) {
            console.error(`Error updating row ${i + 1}:`, error);
            let detail = error.message || 'Unknown error';
            const fieldErrors = error?.response?.errors || error?.response?.data?.errors;
            if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
              detail = `${detail}: ${fieldErrors.join(', ')}`;
            }
            currentImportErrors.push(`Row ${i + 1} (${productData.name || 'N/A'}): Failed to update - ${detail}`);
          }
          continue;
        }
      }

      // Create new product if no duplicate or no SKU. Shared-across-stores
      // is a single choice for the whole import batch (see the checkbox in
      // the preview step) — new products from this import all get it.
      try {
        const created = await createProduct(buildProductFormData({ ...finalProductData, shareAcrossStores } as any, true));
        if (isSerializedRow) {
          await createPieceForRow(created.id);
        }
        // Index the newly-created product so a later row in this SAME file
        // with the same SKU is treated as a duplicate too, not re-created.
        if (created.sku) skuIndex.set(created.sku, created);
        successCount++;
      } catch (error: any) {
        console.error(`Error importing row ${i + 1}:`, error);
        // Surface the backend's specific validation errors (e.g. "Size is
        // required") instead of just the generic "Attribute validation failed"
        // — without this the user has no idea which field is the problem.
        let detail = error.message || 'Failed to import';
        const fieldErrors = error?.response?.errors || error?.response?.data?.errors;
        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
          detail = `${detail}: ${fieldErrors.join(', ')}`;
        }
        currentImportErrors.push(`Row ${i + 1} (${productData.name || 'N/A'}): ${detail}`);
      }
    }

    setImportResults({ success: successCount, errors: currentImportErrors.length, skipped: skippedCount, updated: updatedCount });
    setImportErrors(currentImportErrors.slice(0, 100)); // Limit displayed errors
    setIsProcessing(false);
    setStep('complete');
    
    // Call onImportSuccess callback to refresh parent component
    if (onImportSuccess && successCount > 0) {
      onImportSuccess();
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="text-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
            />
            <button 
              onClick={handleUploadClick} 
              className="mb-4 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center mx-auto">
              <Upload size={20} className="mr-2" /> Choose Spreadsheet File
            </button>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mb-2">Supported formats: .xlsx, .xls, .csv</p>
            <button 
              onClick={downloadTemplate} 
              className="text-primary hover:underline flex items-center justify-center mx-auto">
              <Download size={16} className="mr-1" /> Download Template
            </button>
          </div>
        );
      case 'mapping':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-1">Map Columns</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4">Match columns from your file to the product fields in our system. Required fields are marked with *.</p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {fileColumns.map(fileCol => {
                const currentMap = mappedFields.find(mf => mf.fileColumn === fileCol);
                return (
                  <div key={fileCol} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center p-3 bg-gray-50 dark:bg-muted/50 rounded-md">
                    <div className="text-sm font-medium text-gray-700 dark:text-foreground truncate" title={fileCol}>{fileCol}</div>
                    <select 
                      value={currentMap?.dbField || ''} 
                      onChange={(e) => handleMappingChange(fileCol, e.target.value || null)}
                      className="block w-full border border-gray-300 dark:border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ring focus:border-blue-500 text-sm"
                    >
                      <option value="">-- Select Field --</option>
                      {columnDefinitions.map(dbCol => (
                        <option key={dbCol.key} value={dbCol.key}>
                          {dbCol.label} {dbCol.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'preview':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Preview Import Data</h3>
            <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
              <span className="font-semibold text-foreground">{fileData.length}</span> product{fileData.length !== 1 ? 's' : ''} ready to import. Showing the first {Math.min(10, fileData.length)} row{Math.min(10, fileData.length) !== 1 ? 's' : ''} below for preview.
            </p>

            {/* Pre-import validation — checked across ALL rows, not just the
                preview table, so a bad value on row 47 doesn't only surface
                after the import call already failed for it. */}
            {previewValidationErrors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2">
                  {previewValidationErrors.length} row{previewValidationErrors.length !== 1 ? 's' : ''} need{previewValidationErrors.length === 1 ? 's' : ''} attention before importing
                </h4>
                <p className="text-xs text-red-700 mb-2">
                  Go back to Column Mapping to fix these, or correct the values in your spreadsheet and re-upload. "Start Import" is disabled until these are resolved.
                </p>
                <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                  {previewValidationErrors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Row {e.row} ({e.product}): {e.errors.join(', ')}
                    </li>
                  ))}
                  {previewValidationErrors.length > 50 && (
                    <li>...and {previewValidationErrors.length - 50} more.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Duplicate SKU Handling Option */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Duplicate SKU Handling</h4>
              <p className="text-xs text-yellow-700 mb-3">
                Choose how to handle products with SKUs that already exist in your inventory:
              </p>
              <select 
                value={duplicateHandling} 
                onChange={(e) => setDuplicateHandling(e.target.value as DuplicateHandling)}
                className="block w-full px-3 py-2 border border-yellow-300 rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-blue-500 sm:text-sm bg-white dark:bg-card"
              >
                <option value="skip">Skip - Don't import products with duplicate SKUs</option>
                <option value="update">Update - Update existing products with new data</option>
                <option value="error">Error - Stop import if duplicates are found</option>
              </select>
            </div>

            {/* Sharing choice for newly-created products */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shareAcrossStores}
                  onChange={(e) => setShareAcrossStores(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
                />
                <span className="text-sm text-gray-700 dark:text-foreground">
                  Share newly-created products across all stores
                  <span className="block text-xs text-gray-500 dark:text-muted-foreground font-normal mt-0.5">
                    Matches the default when adding a single product. Uncheck to import these as
                    specific to the store you're currently in instead. This only applies to brand
                    new products from this file — existing products matched by SKU keep whatever
                    sharing status they already have.
                  </span>
                </span>
              </label>
            </div>

            <div className="overflow-auto border border-gray-200 dark:border-border rounded-lg max-h-[40vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-muted/50">
                  <tr>
                    {columnDefinitions.filter(cd => mappedFields.some(mf => mf.dbField === cd.key)).map(cd => (
                      <th key={cd.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        {cd.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-card divide-y divide-gray-200">
                  {previewData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columnDefinitions.filter(cd => mappedFields.some(mf => mf.dbField === cd.key)).map(cd => (
                        <td key={cd.key} className="px-4 py-2 whitespace-nowrap truncate">{String(row[cd.key] === undefined ? '' : row[cd.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'import':
        return (
          <div className="text-center py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-gray-700 dark:text-foreground">Importing products...</p>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">Please wait, this may take a few moments.</p>
          </div>
        );
      case 'complete':
        return (
          <div className="text-center">
            {importResults.errors === 0 ? (
              <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            ) : (
              <AlertCircle size={48} className="mx-auto text-orange-500 mb-3" />
            )}
            <h3 className="text-xl font-semibold mb-2">Import Complete</h3>
            <div className="space-y-1">
              <p className="text-green-600">Successfully imported: {importResults.success} products</p>
              {importResults.updated > 0 && (
                <p className="text-primary">Updated existing products: {importResults.updated} products</p>
              )}
              {importResults.skipped > 0 && (
                <p className="text-yellow-600">Skipped duplicates: {importResults.skipped} products</p>
              )}
              {importResults.errors > 0 && (
                <p className="text-red-600">Failed to import: {importResults.errors} products</p>
              )}
            </div>
            {importErrors.length > 0 && (
              <div className="mt-4 text-left max-h-60 overflow-y-auto border border-gray-200 dark:border-border p-3 rounded-md bg-gray-50 dark:bg-muted/50">
                <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-foreground">Error Details (first 100 errors):</h4>
                <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                  {importErrors.map((err, index) => <li key={index}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200 dark:border-border shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-foreground">Import Products</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:text-muted-foreground shrink-0">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {renderStepContent()}
        </div>

        {(step === 'mapping' || step === 'preview') && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-200 dark:border-border flex justify-between items-center shrink-0">
            <button 
              onClick={handlePreviousStep}
              disabled={isProcessing}
              className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-border rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50 disabled:opacity-50 flex items-center"
            >
              <ArrowLeft size={16} className="mr-1" /> Previous
            </button>
            <button
              onClick={handleNextStep}
              disabled={isProcessing || (step === 'preview' && previewValidationErrors.length > 0)}
              title={step === 'preview' && previewValidationErrors.length > 0 ? 'Fix the highlighted rows before importing' : undefined}
              className="px-3 sm:px-4 py-2 bg-primary text-white rounded-md shadow-sm text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center"
            >
              {step === 'preview' ? 'Start Import' : 'Next'} <ArrowRight size={16} className="ml-1" />
            </button>
          </div>
        )}
        {step === 'complete' && (
           <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-200 dark:border-border flex justify-end shrink-0">
             <button 
                onClick={onClose}
                className="px-4 py-2 bg-primary text-white rounded-md shadow-sm text-sm font-medium hover:bg-primary/90"
              >
                Close
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default ProductImport;
