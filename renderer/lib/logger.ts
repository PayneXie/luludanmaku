class JLogger {
  private static instance: JLogger;
  private context: string;

  private constructor(context: string) {
    this.context = context;
  }

  public static getInstance(context: string): JLogger {
    return new JLogger(context);
  }

  public debug(message: string, ...args: any[]) {
    console.debug(`[${this.context}] [DEBUG] ${message}`, ...args);
  }

  public info(message: string, ...args: any[]) {
    console.info(`[${this.context}] [INFO] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]) {
    console.warn(`[${this.context}] [WARN] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]) {
    console.error(`[${this.context}] [ERROR] ${message}`, ...args);
  }
}

export default JLogger;
