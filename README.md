# Ebook
Wymagania wstępne

Zainstalowana Java - Wymagany jest Java Development Kit (JDK) w wersji 17 lub nowszej

Zainstalowany MySQL Server - Aplikacja używa MySQL jako bazy danych

Środowisko programistyczne (IDE) - IntelliJ IDEA, Eclipse lub inne IDE dla Javy


Instrukcja uruchomienia aplikacji FbReaderWeb

Krok 1: Przygotowanie bazy danych MySQL

1 - Uruchom MySQL na swoim komputerze.
2 - Zaloguj się do MySQL z uprawnieniami administratora.
3 - Utwórz bazę danych 'fbreader':

CREATE DATABASE fbreader;

4 - Utwórz użytkownika z hasłem (możesz wybrać dowolną nazwę użytkownika i hasło):

CREATE USER 'twój_użytkownik'@'localhost' IDENTIFIED BY 'twoje_hasło';

5 - Nadaj użytkownikowi uprawnienia do bazy danych 'fbreader':
GRANT ALL PRIVILEGES ON fbreader.* TO 'twój_użytkownik'@'localhost';
FLUSH PRIVILEGES;


Krok 2: Konfiguracja aplikacji

1 - Otwórz projekt w IDE (IntelliJ IDEA, Eclipse lub innym).
2 - Znajdź plik application.properties w folderze src/main/resources.
3 - Zmień lub sprawdź ustawienia połączenia z bazą danych (użyj utworzonych wcześniej danych):

spring.datasource.url=jdbc:mysql://localhost:3306/fbreader
spring.datasource.username=twój_użytkownik
spring.datasource.password=twoje_hasło
spring.jpa.hibernate.ddl-auto=update


Krok 3: Uruchomienie aplikacji

1 - W swoim IDE znajdź główną klasę aplikacji FbReaderWebApplication.java.
2 - Kliknij prawym przyciskiem myszy na tym pliku i wybierz "Run" lub "Uruchom jako aplikację Java".
3 - Poczekaj na pełne uruchomienie aplikacji. W konsoli powinna pojawić się informacja, że aplikacja została uruchomiona na porcie 8080.

Krok 4: Dostęp do strony internetowej

1 - Otwórz dowolną przeglądarkę internetową (Chrome, Firefox, Edge itd.).
2 - W pasku adresu wpisz:

http://localhost:8080

Naciśnij Enter.

Dodatkowe adresy URL:

Strona logowania: http://localhost:8080/login
Rejestracja: http://localhost:8080/register
Biblioteka: http://localhost:8080/library (wymaga autoryzacji)

Możliwe problemy i ich rozwiązania:

Jeśli strona wyświetla błąd, sprawdź konsolę aplikacji w poszukiwaniu komunikatów o błędach, aby uzyskać bardziej szczegółowe informacje.
