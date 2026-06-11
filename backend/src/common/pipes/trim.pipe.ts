import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.trimDeep(value);
  }

  private trimDeep(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.trimDeep(item));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        result[key] = this.trimDeep((value as Record<string, unknown>)[key]);
      }
      return result;
    }
    return value;
  }
}
