/**
 * 本地OCR服务 - 使用Tesseract.js进行体脂秤图片识别
 * 优点：完全免费、无需网络、保护隐私、响应快速
 */
import Tesseract, { createWorker, Worker } from 'tesseract.js';

// 识别结果接口
export interface FitnessOcrResult {
  weight?: number;
  height?: number;
  bodyFat?: number;
  bmi?: number;
  visceralFat?: number;
  fatMass?: number;
  muscleRate?: number;
  muscleMass?: number;
  bodyWaterRate?: number;
  bodyWaterMass?: number;
  proteinRate?: number;
  proteinMass?: number;
  boneRate?: number;
  boneMass?: number;
  skeletalMuscleRate?: number;
  skeletalMuscleMass?: number;
  subcutaneousFatRate?: number;
  subcutaneousFatMass?: number;
}

// OCR进度回调
export type OcrProgressCallback = (progress: number, status: string) => void;

let workerInstance: Worker | null = null;

/**
 * 初始化Tesseract Worker（复用实例提高性能）
 */
async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await createWorker('eng+chi_sim', 1, {
      logger: (m) => {
        console.log('[Tesseract]', m.status, m.progress);
      },
    });
  }
  return workerInstance;
}

/**
 * 图片预处理 - 提高识别准确率
 * 将base64图片转换为ImageData以便处理
 */
function preprocessImage(base64Data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 创建Canvas进行图像处理
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Data);
        return;
      }

      // 计算缩放比例（增大图片尺寸提高识别率）
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      // 绘制处理后的图片
      ctx.drawImage(img, 0, 0, width, height);
      
      // 转换为灰度图（可选，提高数字识别率）
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // 灰度转换
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // 转换回base64
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = `data:image/png;base64,${base64Data}`;
  });
}

/**
 * 从识别文本中解析体脂秤数据
 * 体脂秤数据格式通常为：标签 + 数值 + 单位
 */
function parseFitnessData(text: string): FitnessOcrResult {
  const result: FitnessOcrResult = {};
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  
  // 定义指标映射表（支持多种标签格式）
  const metricsMap: Record<string, keyof FitnessOcrResult> = {
    // 体重相关
    '体重': 'weight',
    'weight': 'weight',
    '体重量': 'weight',
    '重量': 'weight',
    
    // 身高相关
    '身高': 'height',
    'height': 'height',
    
    // 体脂相关
    '体脂': 'bodyFat',
    '体脂率': 'bodyFat',
    'body fat': 'bodyFat',
    '脂肪': 'bodyFat',
    
    // BMI
    'bmi': 'bmi',
    '体质指数': 'bmi',
    'b.m.i': 'bmi',
    
    // 内脏脂肪
    '内脏脂肪': 'visceralFat',
    'visceral fat': 'visceralFat',
    '内脏': 'visceralFat',
    
    // 脂肪量
    '脂肪量': 'fatMass',
    'fat mass': 'fatMass',
    
    // 肌肉率
    '肌肉率': 'muscleRate',
    'muscle rate': 'muscleRate',
    '肌肉': 'muscleRate',
    
    // 肌肉量
    '肌肉量': 'muscleMass',
    'muscle mass': 'muscleMass',
    
    // 水分率
    '水分率': 'bodyWaterRate',
    '水分': 'bodyWaterRate',
    'body water': 'bodyWaterRate',
    
    // 水分量
    '水分量': 'bodyWaterMass',
    'body water mass': 'bodyWaterMass',
    
    // 蛋白质率
    '蛋白质率': 'proteinRate',
    'protein rate': 'proteinRate',
    '蛋白': 'proteinRate',
    
    // 蛋白质质量
    '蛋白质': 'proteinMass',
    'protein mass': 'proteinMass',
    
    // 骨量率
    '骨量率': 'boneRate',
    'bone rate': 'boneRate',
    '骨率': 'boneRate',
    
    // 骨量
    '骨量': 'boneMass',
    'bone mass': 'boneMass',
    
    // 骨骼肌率
    '骨骼肌率': 'skeletalMuscleRate',
    'skeletal muscle rate': 'skeletalMuscleRate',
    
    // 骨骼肌量
    '骨骼肌量': 'skeletalMuscleMass',
    'skeletal muscle mass': 'skeletalMuscleMass',
    
    // 皮下脂肪率
    '皮下脂肪率': 'subcutaneousFatRate',
    'subcutaneous fat rate': 'subcutaneousFatRate',
    
    // 皮下脂肪量
    '皮下脂肪': 'subcutaneousFatMass',
    'subcutaneous fat': 'subcutaneousFatMass',
  };
  
  // 匹配数值（支持小数和负数）
  const numberPattern = /[-+]?\d+\.?\d*/g;
  
  // 处理每一行
  for (const line of lines) {
    // 查找匹配的标签
    for (const [label, field] of Object.entries(metricsMap)) {
      // 检查标签是否存在（不区分大小写）
      const lowerLine = line.toLowerCase();
      const lowerLabel = label.toLowerCase();
      
      if (lowerLine.includes(lowerLabel)) {
        // 提取数值
        const numbers = line.match(numberPattern);
        if (numbers && numbers.length > 0) {
          const value = parseFloat(numbers[0]);
          
          // 根据字段类型进行合理转换
          if (field === 'weight') {
            // 体重通常在20-200kg之间
            if (value >= 20 && value <= 300 && !result.weight) {
              result.weight = value;
            }
          } else if (field === 'height') {
            // 身高通常在100-220cm之间
            if (value >= 100 && value <= 250 && !result.height) {
              result.height = value;
            }
          } else if (field === 'bmi') {
            // BMI通常在10-50之间
            if (value >= 10 && value <= 60 && !result.bmi) {
              result.bmi = value;
            }
          } else if (['bodyFat', 'visceralFat', 'muscleRate', 'bodyWaterRate', 
                      'proteinRate', 'boneRate', 'skeletalMuscleRate', 'subcutaneousFatRate'].includes(field)) {
            // 百分比指标通常在0-100之间
            if (value >= 0 && value <= 100 && !result[field]) {
              result[field] = value;
            }
          } else if (['fatMass', 'muscleMass', 'bodyWaterMass', 'proteinMass', 
                      'boneMass', 'skeletalMuscleMass', 'subcutaneousFatMass'].includes(field)) {
            // 质量指标通常在0-100kg之间
            if (value >= 0 && value <= 150 && !result[field]) {
              result[field] = value;
            }
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * 使用本地Tesseract.js识别体脂秤图片
 * @param base64Image - Base64编码的图片数据（不包含data:image前缀）
 * @param onProgress - 进度回调函数
 * @returns 识别的体脂秤数据
 */
export async function recognizeFitnessImageLocal(
  base64Image: string,
  onProgress?: OcrProgressCallback
): Promise<FitnessOcrResult> {
  try {
    // 步骤1：图片预处理
    onProgress?.(0.1, '正在预处理图片...');
    const processedImage = await preprocessImage(base64Image);
    const imageData = processedImage.split(',')[1] || processedImage;
    
    // 步骤2：初始化Worker
    onProgress?.(0.2, '正在加载OCR引擎...');
    const worker = await getWorker();
    
    // 步骤3：执行识别
    onProgress?.(0.3, '正在识别文字...');
    const { data: { text } } = await worker.recognize(
      `data:image/png;base64,${imageData}`
    );
    
    onProgress?.(0.9, '正在解析数据...');
    
    // 步骤4：解析数据
    const result = parseFitnessData(text);
    
    // 步骤5：清理Worker（可选，保留以提高复用效率）
    onProgress?.(1.0, '识别完成');
    
    console.log('[OCR] 识别结果:', result);
    console.log('[OCR] 原始文本:', text);
    
    return result;
  } catch (error) {
    console.error('[OCR] 识别失败:', error);
    throw new Error(`图片识别失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 销毁OCR Worker实例（释放内存）
 */
export async function destroyOcrWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
