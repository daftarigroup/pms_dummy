import { z } from 'zod';
import type { UseFormReturn, UseFieldArrayRemove } from 'react-hook-form';

// Zod schema definitions
export const productSchema = z.object({
    department: z.string().optional(),
    groupHead: z.string().min(1, 'Group head is required'),
    productName: z.string().min(1, 'Product name is required'),
    quantity: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
        z.number().gt(0, 'Must be greater than 0')
    ),
    uom: z.string().min(1, 'UOM is required'),
    areaOfUse: z.string().min(1, 'Area of use is required'),
    priority: z.enum(['Low', 'Normal', 'High', 'Urgent'] as const),
    attachment: z.any().optional().nullable(),
    specifications: z.string().optional(),
    location: z.string().optional(),
});

export const formSchema = z.object({
    indenterName: z.string().min(1, 'Indenter name is required'),
    approvedByWhom: z.string().min(1, 'Approver is required'),
    status: z.enum(['Purchase', 'Store Out'] as const),
    products: z.array(productSchema).min(1, 'At least one product is required'),
});

// TypeScript inferred types from Zod schemas
export type ProductFormValues = z.infer<typeof productSchema>;
export type FormValues = z.infer<typeof formSchema>;

// Types for your options data
export type ProductOptionTuple = [string, string];

export type GroupOptions = {
    [groupName: string]: ProductOptionTuple[];
};

export type OptionsData = {
    groups: GroupOptions;
    units: string[];
    departments: string[];
    areaOfUse: string[];
    approvers: string[];
};

// Props for the main component
export interface IndentFormProps {
    options: OptionsData;
}

// Props for the child field array component
export interface ProductsFieldArrayProps {
    control: any;
    register: any;
    errors: any;
    options: OptionsData;
    watch: any;
    setValue: any;
}
