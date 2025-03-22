# Ebook
Instrukcja uruchomienia aplikacji FbReaderWeb
Krok 1: Przygotowanie bazy danych MySQL

Uruchom MySQL na swoim komputerze.
Zaloguj się do MySQL z uprawnieniami administratora.
Utwórz bazę danych 'fbreader':
sqlCopyCREATE DATABASE fbreader;

Utwórz użytkownika z hasłem (możesz wybrać dowolną nazwę użytkownika i hasło):
sqlCopyCREATE USER 'twój_użytkownik'@'localhost' IDENTIFIED BY 'twoje_hasło';

Nadaj użytkownikowi uprawnienia do bazy danych 'fbreader':
sqlCopyGRANT ALL PRIVILEGES ON fbreader.* TO 'twój_użytkownik'@'localhost';
FLUSH PRIVILEGES;


Krok 2: Konfiguracja aplikacji

Otwórz projekt w IDE (IntelliJ IDEA, Eclipse lub innym).
Znajdź plik application.properties w folderze src/main/resources.
Zmień lub sprawdź ustawienia połączenia z bazą danych (użyj utworzonych wcześniej danych):
propertiesCopyspring.datasource.url=jdbc:mysql://localhost:3306/fbreader
spring.datasource.username=twój_użytkownik
spring.datasource.password=twoje_hasło
spring.jpa.hibernate.ddl-auto=update


Krok 3: Uruchomienie aplikacji

W swoim IDE znajdź główną klasę aplikacji FbReaderWebApplication.java.
Kliknij prawym przyciskiem myszy na tym pliku i wybierz "Run" lub "Uruchom jako aplikację Java".
Poczekaj na pełne uruchomienie aplikacji. W konsoli powinna pojawić się informacja, że aplikacja została uruchomiona na porcie 8080.

Krok 4: Dostęp do strony internetowej

Otwórz dowolną przeglądarkę internetową (Chrome, Firefox, Edge itd.).
W pasku adresu wpisz:
Copyhttp://localhost:8080

Naciśnij Enter.

Dodatkowe adresy URL:

Strona logowania: http://localhost:8080/login
Rejestracja: http://localhost:8080/register
Biblioteka: http://localhost:8080/library (wymaga autoryzacji)

Możliwe problemy i ich rozwiązania:

Aplikacja nie uruchamia się - sprawdź logi w konsoli, upewnij się, że ustawienia bazy danych są prawidłowe.
Błąd dostępu do bazy danych - upewnij się, że MySQL jest uruchomiony i ustawienia połączenia są poprawne.
Strona nie otwiera się - sprawdź, czy aplikacja została pomyślnie uruchomiona i czy serwer nie jest blokowany przez zaporę.
Błąd dostępu - dostęp do niektórych stron może wymagać rejestracji lub autoryzacji.

Jeśli strona wyświetla błąd, sprawdź konsolę aplikacji w poszukiwaniu komunikatów o błędach, aby uzyskać bardziej szczegółowe informacje.
