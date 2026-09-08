import type { WorkflowNode } from '@/types/comfyui';

export interface EditableParam {
  key: string;
  nodeId: string;
  label: string;
  type: 'number' | 'float' | 'string' | 'boolean' | 'combo';
  value: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface ParsedWorkflow {
  workflow: Record<string, WorkflowNode>;
  params: EditableParam[];
  isUIFormat: boolean;
}

function isConnection(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string';
}

function normalizeWorkflowNodes(nodes: unknown): Record<string, WorkflowNode> | null {
  if (Array.isArray(nodes)) {
    const result: Record<string, WorkflowNode> = {};
    nodes.forEach((node, index) => {
      if (typeof node !== 'object' || node === null) return;
      const n = node as Record<string, unknown>;
      const classType = n['type'];
      const widgetValues = n['widgets_values'] as unknown[] | undefined;
      if (typeof classType === 'string') {
        const inputs: Record<string, unknown> = {};
        if (Array.isArray(widgetValues)) {
          widgetValues.forEach((v, i) => {
            const inputNames = Array.isArray(n['widgets']) ? (n['widgets'] as unknown[]) : undefined;
            const widget = inputNames?.[i] as { name?: string } | undefined;
            const key = widget?.name || `widget_${i}`;
            inputs[key] = v;
          });
        }
        const links = n['inputs'] as unknown[] | undefined;
        if (Array.isArray(links)) {
          (links as Array<{ name?: string; link?: number }>).forEach((input, i) => {
            const key = input?.name || `input_${i}`;
            if (typeof input?.link === 'number') {
              inputs[key] = ['<workflow>', 0];
            }
          });
        }
        result[String(index + 1)] = {
          class_type: classType,
          inputs,
        } as WorkflowNode;
      }
    });
    return result;
  }

  if (typeof nodes === 'object' && nodes !== null) {
    const first = Object.values(nodes)[0];
    if (
      typeof first === 'object' &&
      first !== null &&
      'class_type' in (first as object)
    ) {
      return nodes as Record<string, WorkflowNode>;
    }
  }
  return null;
}

export function parseWorkflow(json: unknown): ParsedWorkflow | null {
  if (typeof json !== 'object' || json === null) return null;
  const input = json as Record<string, unknown>;

  let workflow: Record<string, WorkflowNode> | null = null;
  let isUIFormat = false;

  if (typeof input['prompt'] === 'object' && input['prompt'] !== null) {
    workflow = normalizeWorkflowNodes(input['prompt']);
  } else {
    workflow = normalizeWorkflowNodes(input);
  }

  isUIFormat = !workflow;

  if (!workflow) return null;

  // detect plausible editable scalars
  const params: EditableParam[] = [];
  Object.entries(workflow).forEach(([nodeId, node]) => {
    Object.entries(node.inputs).forEach(([key, value]) => {
      if (isConnection(value)) return;
      const param: EditableParam = {
        key: `${nodeId}.${key}`,
        nodeId,
        label: key,
        type: 'string',
        value,
      };
      if (typeof value === 'number') {
        param.type = Number.isInteger(value) ? 'number' : 'float';
      } else if (typeof value === 'boolean') {
        param.type = 'boolean';
      } else if (Array.isArray(value)) {
        param.type = 'combo';
        param.options = value.map(String);
        param.value = value.length > 0 ? value[0] : '';
      }
      params.push(param);
    });
  });

  return { workflow, params, isUIFormat };
}

export function applyParamValues(
  workflow: Record<string, WorkflowNode>,
  values: Record<string, unknown>
): Record<string, WorkflowNode> {
  const result: Record<string, WorkflowNode> = JSON.parse(JSON.stringify(workflow));
  Object.entries(values).forEach(([key, value]) => {
    const [nodeId, inputKey] = key.split('.');
    if (result[nodeId] && inputKey) {
      result[nodeId].inputs[inputKey] = value;
    }
  });
  return result;
}