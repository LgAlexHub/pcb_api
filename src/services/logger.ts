// Récupération du nom du scraper depuis les variables d'environnement
const scrapperName: string | undefined = Deno.env.get('SCRAPPER_NAME');

/**
 * Enumeration des différents types de log
 */
export enum LogType {
    info = 'INFO',
    debug = 'DEBUG',
    error = 'ERROR',
}

/**
 * Interface définissant les paramètres d'options pour la classe Logger
 */
export type LogOptionsParams = {
  // Type de log (INFO, DEBUG, ERROR)
  type: LogType | null | undefined;
  // Préfixe à utiliser pour les logs
  prefix: string | null | undefined;
  // Affichage des timestamps dans les logs
  withTimestamps: boolean | null | undefined;
}

/**
 * Classe Logger permettant de gérer les logs dans l'application
 */
export class LoggerService {
  // Type de log par défaut
  public type: LogType = LogType.info;
  // Préfixe à utiliser dans les logs
  public prefix: string | null | undefined;
  // Affichage des timestamps dans les logs
  public withTimestamps: boolean = false;

  /**
   * Constructeur de la classe Logger
   * @param options - Paramètres d'options pour la configuration du logger
   */
  constructor(options: LogOptionsParams) {
    // Définition du type de log
    if (typeof options.type !== 'undefined' && options.type !== null) {
      this.type = options.type;
    }
    // Définition de l'affichage des timestamps
    if (typeof options.withTimestamps !== 'undefined' && options.withTimestamps !== null) {
      this.withTimestamps = options.withTimestamps;
    }
    // Définition du préfixe
    this.prefix = options.prefix;
  }

  /**
   * Méthode permettant de retourner une représentation JSON de l'objet Logger
   * @returns {string} - Représentation JSON de l'objet Logger
   */
  public toString(): string {
    return JSON.stringify({
      type: this.type,
      prefix: this.prefix,
      withTimestamps: this.withTimestamps,
    });
  }

  /**
   * Méthode statique permettant de créer un objet Logger à partir d'une chaîne JSON
   * @param json - Chaîne JSON représentant un objet Logger
   * @returns {Logger} - Nouvel objet Logger
   */
  static fromJSONString(json: string): LoggerService {
    return new LoggerService(JSON.parse(json));
  }

  /**
   * Méthode permettant d'afficher un message de log dans la console
   * @param coreMessage - Message principal à afficher dans le log
   */
  public log(coreMessage: string): void {
    // Récupération de la date actuelle
    const logDate = new Date();

    // Formatage du message de log
    let message = ``;
    message += `[${typeof this.prefix !== 'undefined' && this.prefix !== null ? this.prefix : scrapperName}]`;
    message += `[${this.type}] - ${logDate.getDate()}/${logDate.getMonth()}/${logDate.getFullYear()} - ${logDate.getHours()}:${logDate.getMinutes()}:${logDate.getSeconds()}:${logDate.getMilliseconds()} `;
    message += coreMessage;

    // Affichage du message de log dans la console
    console.log(message);
  }

  public error(errorMessage: string) : void {
    const previousType = this.type;
    this.type = LogType.error;
    this.log(errorMessage);
    this.type = previousType;
  }

  public debug(debugStatement: string) : void {
    const previousType = this.type;
    this.type = LogType.debug;
    this.log(debugStatement);
    this.type = previousType;
  }
}